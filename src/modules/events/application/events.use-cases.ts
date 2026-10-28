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
  type EventPageFilter,
} from "@/modules/events/application/ports/events.ports";
import {
  checkSchedule,
  checkStatusChange,
  EventStatus,
  normalizeSetlist,
  type BandEvent,
  EventType,
  type SetlistItem,
  type StatusDenial,
  EventUniform,
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
  venueId: string;
  uniform: EventUniform;
  requester?: string | null;
  documentRef?: string | null;
  notes?: string | null;
  /** The list of songs, saved with the event; undefined = keep it. */
  setlist?: { songId: string; notes?: string | null }[];
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

import type { PageRequest, Paginated } from "@/shared/application/pagination";

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

  /** The events page (period relative to now). */
  page(
    filter: Omit<EventPageFilter, "now">,
    page: PageRequest,
  ): Promise<Paginated<BandEvent>> {
    return this.events.page({ ...filter, now: this.clock.now() }, page);
  }

  setlistCounts(eventIds: readonly string[]): Promise<Map<string, number>> {
    return this.events.countSetlists(eventIds);
  }

  list(filter: EventFilter): Promise<BandEvent[]> {
    return this.events.list(filter, MAX_EVENTS_PER_QUERY);
  }

  /**
   * Next events not cancelled nor done, starting from now. Working days
   * (expediente) are left out: they have their own list.
   */
  upcoming(limit: number): Promise<BandEvent[]> {
    return this.events.list(
      {
        from: this.clock.now(),
        statuses: [EventStatus.PLANEJADO, EventStatus.CONFIRMADO],
        excludeType: EventType.EXPEDIENTE,
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
    const setlist = input.setlist
      ? await this.validSetlist(input.setlist)
      : undefined;
    const event = await this.events.create(data, actor.id, setlist);
    await this.stamp(actor, event.id, true);
    return event;
  }

  /**
   * Many events at once, already in `status` (the working days of an
   * expediente): one insert and one stamp, however many days.
   */
  async createMany(
    actor: AuthenticatedUser,
    inputs: readonly EventInput[],
    status: EventStatus,
  ): Promise<BandEvent[]> {
    const venueIds = [...new Set(inputs.map((input) => input.venueId))];
    const venues = await this.venues.findByIds(venueIds);
    if (
      venues.length !== venueIds.length ||
      venues.some((venue) => venue.archived)
    ) {
      throw AppException.from(APP_ERRORS.events.venueNotFound, undefined);
    }
    const data = inputs.map((input) => this.dataOf(input));
    const events = await this.events.createMany(data, actor.id, status);
    await this.audit.stampMany({
      actorId: actor.id,
      entity: "event",
      entityIds: events.map((event) => event.id),
      created: true,
    });
    return events;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: EventInput,
  ): Promise<BandEvent> {
    const before = await this.editable(id);
    const data = await this.toData(input);
    const setlist = input.setlist
      ? await this.validSetlist(input.setlist)
      : undefined;
    const changed = rescheduled(before, { ...before, ...data });
    const event = await this.events.update(
      id,
      data,
      changed
        ? [
            eventChangedDraft({
              eventId: id,
              change: "RESCHEDULED",
              actorId: actor.id,
            }),
          ]
        : [],
      setlist,
    );
    if (changed) this.outbox.kick();
    await this.stamp(actor, id);
    return event;
  }

  async changeStatus(
    actor: AuthenticatedUser,
    id: string,
    status: EventStatus,
    reason: string | null,
    /** false: the caller tells the people itself (e.g. a whole batch). */
    notify = true,
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
    const announce = cancelled && notify;
    const event = await this.events.setStatus(
      id,
      status,
      cancelled ? text(reason) : null,
      announce
        ? [
            eventChangedDraft({
              eventId: id,
              change: "CANCELLED",
              actorId: actor.id,
            }),
          ]
        : [],
    );
    if (announce) this.outbox.kick();
    await this.stamp(actor, id);
    return event;
  }

  async replaceSetlist(
    actor: AuthenticatedUser,
    id: string,
    items: { songId: string; notes?: string | null }[],
  ): Promise<SetlistItem[]> {
    await this.editable(id);
    const setlist = await this.validSetlist(items);
    await this.events.replaceSetlist(id, setlist);
    await this.stamp(actor, id);
    return setlist;
  }

  // Done is final; cancelled is locked until reopened (back to planned).
  /** In order, without repeats, only songs still in the repertoire. */
  private async validSetlist(
    items: readonly { songId: string; notes?: string | null }[],
  ): Promise<SetlistItem[]> {
    const setlist = normalizeSetlist([...items]);
    if (setlist.length > MAX_SETLIST) {
      throw AppException.from(APP_ERRORS.events.setlistTooLong, undefined);
    }
    if (setlist.length === 0) return setlist;
    const found = await this.songs.findMany(setlist.map((item) => item.songId));
    const usable = new Set(
      found.filter((song) => !song.archivedAt).map((song) => song.id),
    );
    if (setlist.some((item) => !usable.has(item.songId))) {
      throw AppException.from(APP_ERRORS.events.setlistUnknownSong, undefined);
    }
    return setlist;
  }

  private async editable(id: string): Promise<BandEvent> {
    const event = await this.get(id);
    if (event.status === EventStatus.REALIZADO) {
      throw AppException.from(APP_ERRORS.events.eventDone, undefined);
    }
    if (event.status === EventStatus.CANCELADO) {
      throw AppException.from(APP_ERRORS.events.eventCancelled, undefined);
    }
    return event;
  }

  private async toData(input: EventInput): Promise<EventData> {
    const data = this.dataOf(input);
    const venue = await this.venues.findById(input.venueId);
    if (!venue || venue.archived) {
      throw AppException.from(APP_ERRORS.events.venueNotFound, undefined);
    }
    return data;
  }

  /** Checks the schedule and normalizes the texts (no venue lookup). */
  private dataOf(input: EventInput): EventData {
    const schedule = {
      callTime: input.callTime ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
    };
    if (checkSchedule(schedule).length > 0) {
      throw AppException.from(APP_ERRORS.events.invalidSchedule, undefined);
    }
    return {
      title: input.title.trim().replace(/\s+/g, " "),
      type: input.type,
      ...schedule,
      venueId: input.venueId,
      uniform: input.uniform,
      requester: text(input.requester),
      documentRef: text(input.documentRef),
      notes: text(input.notes),
    };
  }

  private stamp(
    actor: AuthenticatedUser,
    id: string,
    created = false,
  ): Promise<void> {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "event",
      entityId: id,
      created,
    });
  }
}
