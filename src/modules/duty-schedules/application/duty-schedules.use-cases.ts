import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { BandFunctionsUseCase } from "@/modules/band-functions/application/band-functions.use-cases";
import {
  dutyCancelledNotice,
  dutyScheduledNotice,
} from "@/modules/duty-schedules/application/duty-notices";
import {
  DUTY_SCHEDULE_REPOSITORY,
  type DutyScheduleFilter,
  type DutyScheduleRepositoryPort,
} from "@/modules/duty-schedules/application/ports/duty-schedule-repository.port";
import {
  audienceOf,
  checkDutyDays,
  DutyAudienceKind,
  DutyScheduleStatus,
  type DutyAudience,
  type DutyDay,
  type DutyDayProblem,
  type DutySchedule,
} from "@/modules/duty-schedules/domain/duty-schedule";
import { EventsUseCase } from "@/modules/events/application/events.use-cases";
import { VenuesUseCase } from "@/modules/events/application/venues.use-cases";
import {
  EventStatus,
  EventType,
  type BandEvent,
  type EventUniform,
  type Venue,
} from "@/modules/events/domain/event";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import type { RosterEntry } from "@/modules/members/application/ports/member-repository.port";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { RostersUseCase } from "@/modules/rosters/application/rosters.use-cases";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type DutyScheduleInput = {
  title?: string | null;
  venueId: string;
  uniform: EventUniform;
  notes?: string | null;
  days: DutyDay[];
  audience: DutyAudience;
};

/** A batch as the screens show it: days and people resolved. */
export type DutyScheduleView = DutySchedule & {
  venue: Venue | null;
  days: BandEvent[];
  members: RosterEntry[];
};

const DAY_MESSAGES: Record<DutyDayProblem, string> = {
  "no-days": "Marque ao menos um dia de trabalho.",
  "too-many-days": "Um expediente tem no máximo 31 dias.",
  "ends-before-start": "A saída deve ser depois da entrada em todos os dias.",
  "too-long": "Um dia de expediente dura no máximo 24 horas.",
  "same-day-twice": "Cada dia aparece uma vez só.",
  "span-too-long": "O expediente cobre no máximo um mês.",
};

const OPEN = [EventStatus.PLANEJADO, EventStatus.CONFIRMADO];
const DEFAULT_TITLE = "Expediente";
const MUSICIAN = "músico";

@Injectable()
export class DutySchedulesUseCase {
  constructor(
    @Inject(DUTY_SCHEDULE_REPOSITORY)
    private readonly schedules: DutyScheduleRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly events: EventsUseCase,
    private readonly venues: VenuesUseCase,
    private readonly members: MembersUseCase,
    private readonly rosters: RostersUseCase,
    private readonly functions: BandFunctionsUseCase,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  page(
    filter: DutyScheduleFilter,
    page: PageRequest,
  ): Promise<Paginated<DutySchedule>> {
    return this.schedules.page(filter, page);
  }

  async get(id: string): Promise<DutyScheduleView> {
    const schedule = await this.schedules.findById(id);
    if (!schedule) {
      throw AppException.from(APP_ERRORS.dutySchedules.notFound, undefined);
    }
    const [venues, days, band] = await Promise.all([
      this.venues.findMany([schedule.venueId]),
      this.events.findMany(schedule.eventIds),
      this.members.bandMembers(),
    ]);
    const people = new Set(schedule.userIds);
    return {
      ...schedule,
      venue: venues[0] ?? null,
      days: days.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
      members: band.filter((entry) => people.has(entry.userId)),
    };
  }

  /**
   * Creates one EXPEDIENTE event per day with its roster already published
   * (nothing to acknowledge), then tells each person once, with their days.
   */
  async create(
    actor: AuthenticatedUser,
    input: DutyScheduleInput,
  ): Promise<DutySchedule> {
    const days = [...input.days].sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
    );
    const problem = checkDutyDays(days, (date) => this.clock.localDate(date));
    if (problem) {
      throw AppException.from(APP_ERRORS.dutySchedules.invalidDays, {
        reason: DAY_MESSAGES[problem],
      });
    }
    if (
      days[0]!.startsAt < this.clock.startOfLocalDate(this.clock.localDate())
    ) {
      throw AppException.from(APP_ERRORS.dutySchedules.inThePast, undefined);
    }

    const band = await this.members.bandMembers();
    const userIds = audienceOf(
      band.map((entry) => ({
        userId: entry.userId,
        section: entry.profile!.section,
        status: entry.profile!.status,
      })),
      input.audience,
    );
    if (userIds.length === 0) {
      throw AppException.from(
        APP_ERRORS.dutySchedules.emptyAudience,
        undefined,
      );
    }
    const lines = await this.linesFor(band, userIds);
    const title = input.title?.trim() || DEFAULT_TITLE;
    const notes = input.notes?.trim() || null;

    // All days at once: the events (confirmed) and their rosters.
    const events = await this.events.createMany(
      actor,
      days.map((day) => ({
        title,
        type: EventType.EXPEDIENTE,
        startsAt: day.startsAt,
        endsAt: day.endsAt,
        venueId: input.venueId,
        uniform: input.uniform,
        notes,
      })),
      EventStatus.CONFIRMADO,
    );
    const onDay = await this.rosters.assignDutyMany(actor, events, lines);
    const created = events.map((event) => ({
      event,
      people: onDay.get(event.id) ?? [],
    }));

    const venue = (await this.venues.findMany([input.venueId]))[0] ?? null;
    const startsOn = this.clock.localDate(days[0]!.startsAt);
    const endsOn = this.clock.localDate(days[days.length - 1]!.startsAt);
    const scheduled = new Set(created.flatMap((item) => item.people));
    const by = (await this.members.signatureOf(actor)) ?? actor.name;
    const schedule = await this.schedules.create(
      {
        title,
        startsOn,
        endsOn,
        venueId: input.venueId,
        uniform: input.uniform,
        notes,
        audienceKind: input.audience.kind,
        sections:
          input.audience.kind === DutyAudienceKind.SECTIONS
            ? input.audience.sections
            : [],
        eventIds: created.map((item) => item.event.id),
        userIds: [...scheduled],
      },
      actor.id,
      [...scheduled].map((userId) =>
        deliveryDraft(
          dutyScheduledNotice({
            userId,
            title,
            startsOn,
            endsOn,
            days: created
              .filter((item) => item.people.includes(userId))
              .map(({ event }) => ({
                startsAt: event.startsAt,
                endsAt: event.endsAt ?? event.startsAt,
              })),
            venue,
            uniform: input.uniform,
            notes,
            timeZone: this.clock.timeZone,
            by,
          }),
        ),
      ),
    );
    this.outbox.kick();
    await this.stamp(actor, schedule.id, true);
    return schedule;
  }

  /** Cancels the days still ahead (silently) and tells each person once. */
  async cancel(
    actor: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<DutySchedule> {
    const schedule = await this.schedules.findById(id);
    if (!schedule) {
      throw AppException.from(APP_ERRORS.dutySchedules.notFound, undefined);
    }
    if (schedule.status === DutyScheduleStatus.CANCELADA) {
      throw AppException.from(
        APP_ERRORS.dutySchedules.alreadyCancelled,
        undefined,
      );
    }
    const text = reason.trim();
    if (!text) {
      throw AppException.from(
        APP_ERRORS.dutySchedules.reasonRequired,
        undefined,
      );
    }
    const now = this.clock.now();
    const by = (await this.members.signatureOf(actor)) ?? actor.name;
    const days = await this.events.findMany(schedule.eventIds);
    for (const day of days) {
      if (OPEN.includes(day.status) && day.startsAt > now) {
        await this.events.changeStatus(
          actor,
          day.id,
          EventStatus.CANCELADO,
          text,
          false,
        );
      }
    }
    const cancelled = await this.schedules.cancel(
      id,
      text,
      schedule.userIds.map((userId) =>
        deliveryDraft(
          dutyCancelledNotice({
            userId,
            title: schedule.title,
            startsOn: schedule.startsOn,
            endsOn: schedule.endsOn,
            reason: text,
            by,
          }),
          `duty-cancelled:${id}:${userId}`,
        ),
      ),
    );
    this.outbox.kick();
    await this.stamp(actor, id);
    return cancelled;
  }

  /**
   * Each person's line: whoever plays goes as "Músico" with the main
   * instrument; someone with no instrument goes in their own function.
   */
  private async linesFor(band: RosterEntry[], userIds: string[]) {
    const functions = await this.functions.list(false);
    const musicianId = functions.find(
      (item) => item.name.toLocaleLowerCase("pt-BR") === MUSICIAN,
    )?.id;
    const byUser = new Map(band.map((entry) => [entry.userId, entry]));
    return userIds.map((userId) => {
      const profile = byUser.get(userId)!.profile!;
      const instrumentId =
        profile.instruments.find((item) => item.primary)?.instrumentId ?? null;
      const own = profile.functions.find(
        (item) => item.name.toLocaleLowerCase("pt-BR") !== MUSICIAN,
      )?.functionId;
      return {
        userId,
        instrumentId,
        functionId: instrumentId
          ? (musicianId ?? null)
          : (own ?? musicianId ?? null),
      };
    });
  }

  private stamp(
    actor: AuthenticatedUser,
    id: string,
    created = false,
  ): Promise<void> {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "duty_schedule",
      entityId: id,
      created,
    });
  }
}
