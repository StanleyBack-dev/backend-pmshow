import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { eventChangedDraft } from "@/modules/events/application/event-changes";
import {
  EVENT_REPOSITORY,
  VENUE_REPOSITORY,
  type EventData,
  type EventFilter,
  type EventRepositoryPort,
  type VenueRepositoryPort,
} from "@/modules/events/application/ports/events.ports";
import {
  checkSchedule,
  checkStatusChange,
  EventStatus,
  normalizeSetlist,
  type BandEvent,
  type EventType,
  type SetlistItem,
  type StatusDenial,
} from "@/modules/events/domain/event";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type EventInput = {
  title: string;
  type: EventType;
  callTime?: Date | null;
  startsAt: Date;
  endsAt?: Date | null;
  venueId?: string | null;
  uniform?: string | null;
  requester?: string | null;
  documentRef?: string | null;
  notes?: string | null;
};

const MAX_EVENTS_PER_QUERY = 500;
const MAX_SETLIST = 80;

const STATUS_DENIAL_MESSAGES: Record<StatusDenial, string> = {
  "same-status": "O evento já está nessa situação.",
  "not-happened-yet": "Só dá para marcar como realizado depois do início.",
  "cancelled-is-final-for-done":
    "Um evento cancelado não pode ser marcado como realizado. Reabra-o antes.",
  "done-is-final": "Este evento já foi realizado e não pode mudar de situação.",
  "reason-required": "Informe o motivo do cancelamento.",
};

const text = (value: string | null | undefined) => value?.trim() || null;

const sameInstant = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** What people on the event must be told about: when and where. */
const rescheduled = (before: BandEvent, after: BandEvent) =>
  !sameInstant(before.callTime, after.callTime) ||
  !sameInstant(before.startsAt, after.startsAt) ||
  !sameInstant(before.endsAt, after.endsAt) ||
  before.venueId !== after.venueId;

const snapshot = (event: BandEvent) => ({
  title: event.title,
  type: event.type,
  status: event.status,
  callTime: event.callTime?.toISOString() ?? null,
  startsAt: event.startsAt.toISOString(),
  endsAt: event.endsAt?.toISOString() ?? null,
  venueId: event.venueId,
});

@Injectable()
export class EventsUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    @Inject(VENUE_REPOSITORY) private readonly venues: VenueRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly songs: SongsUseCase,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  list(filter: EventFilter): Promise<BandEvent[]> {
    return this.events.list(filter, MAX_EVENTS_PER_QUERY);
  }

  /** Next events not cancelled nor done, starting from now. */
  upcoming(limit: number): Promise<BandEvent[]> {
    return this.events.list(
      {
        from: this.clock.now(),
        statuses: [EventStatus.PLANEJADO, EventStatus.CONFIRMADO],
      },
      Math.min(Math.max(limit, 1), 20),
    );
  }

  async get(id: string): Promise<BandEvent> {
    const event = await this.events.findById(id);
    if (!event) {
      throw AppException.from(APP_ERRORS.events.eventNotFound, undefined);
    }
    return event;
  }

  findMany(ids: readonly string[]): Promise<BandEvent[]> {
    return this.events.findByIds(ids);
  }

  setlist(eventId: string): Promise<SetlistItem[]> {
    return this.events.findSetlist(eventId);
  }

  async create(
    actor: AuthenticatedUser,
    input: EventInput,
  ): Promise<BandEvent> {
    const data = await this.toData(input);
    const event = await this.events.create(data, actor.id);
    await this.record(
      actor,
      "event.created",
      event.id,
      undefined,
      snapshot(event),
    );
    return event;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: EventInput,
  ): Promise<BandEvent> {
    const before = await this.editable(id);
    const data = await this.toData(input);
    const changed = rescheduled(before, { ...before, ...data });
    const event = await this.events.update(
      id,
      data,
      changed
        ? [eventChangedDraft({ eventId: id, change: "RESCHEDULED" })]
        : [],
    );
    if (changed) this.outbox.kick();
    await this.record(
      actor,
      "event.updated",
      id,
      snapshot(before),
      snapshot(event),
    );
    return event;
  }

  async changeStatus(
    actor: AuthenticatedUser,
    id: string,
    status: EventStatus,
    reason: string | null,
  ): Promise<BandEvent> {
    const before = await this.get(id);
    const denial = checkStatusChange(before.status, status, {
      startsAt: before.startsAt,
      now: this.clock.now(),
      reason,
    });
    if (denial) {
      throw AppException.from(APP_ERRORS.events.invalidStatusChange, {
        reason: STATUS_DENIAL_MESSAGES[denial],
      });
    }
    const cancelled = status === EventStatus.CANCELADO;
    const event = await this.events.setStatus(
      id,
      status,
      cancelled ? text(reason) : null,
      cancelled
        ? [eventChangedDraft({ eventId: id, change: "CANCELLED" })]
        : [],
    );
    if (cancelled) this.outbox.kick();
    await this.record(
      actor,
      "event.status_changed",
      id,
      { status: before.status },
      { status: event.status, reason: event.cancellationReason },
    );
    return event;
  }

  async replaceSetlist(
    actor: AuthenticatedUser,
    id: string,
    items: { songId: string; notes?: string | null }[],
  ): Promise<SetlistItem[]> {
    await this.editable(id);
    const setlist = normalizeSetlist(items);
    if (setlist.length > MAX_SETLIST) {
      throw AppException.from(APP_ERRORS.events.setlistTooLong, undefined);
    }
    const found = await this.songs.findMany(setlist.map((item) => item.songId));
    const usable = new Set(
      found.filter((song) => !song.archivedAt).map((song) => song.id),
    );
    if (setlist.some((item) => !usable.has(item.songId))) {
      throw AppException.from(APP_ERRORS.events.setlistUnknownSong, undefined);
    }

    await this.events.replaceSetlist(id, setlist);
    await this.record(actor, "event.setlist_updated", id, undefined, {
      songs: setlist.length,
    });
    return setlist;
  }

  private async editable(id: string): Promise<BandEvent> {
    const event = await this.get(id);
    if (event.status === EventStatus.REALIZADO) {
      throw AppException.from(APP_ERRORS.events.eventDone, undefined);
    }
    return event;
  }

  private async toData(input: EventInput): Promise<EventData> {
    const schedule = {
      callTime: input.callTime ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
    };
    if (checkSchedule(schedule).length > 0) {
      throw AppException.from(APP_ERRORS.events.invalidSchedule, undefined);
    }
    if (input.venueId) {
      const venue = await this.venues.findById(input.venueId);
      if (!venue || venue.archived) {
        throw AppException.from(APP_ERRORS.events.venueNotFound, undefined);
      }
    }
    return {
      title: input.title.trim().replace(/\s+/g, " "),
      type: input.type,
      ...schedule,
      venueId: input.venueId ?? null,
      uniform: text(input.uniform),
      requester: text(input.requester),
      documentRef: text(input.documentRef),
      notes: text(input.notes),
    };
  }

  private record(
    actor: AuthenticatedUser,
    action: string,
    id: string,
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action,
      entity: "event",
      entityId: id,
      before,
      after,
    });
  }
}
