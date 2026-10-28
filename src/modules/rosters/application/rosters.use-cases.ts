import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { AbsencesUseCase } from "@/modules/availability/application/absences.use-cases";
import type { AbsenceType } from "@/modules/availability/domain/absence";
import {
  EVENT_CHANGED_TOPIC,
  type EventChange,
} from "@/modules/events/application/event-changes";
import { EventsUseCase } from "@/modules/events/application/events.use-cases";
import { VenuesUseCase } from "@/modules/events/application/venues.use-cases";
import {
  EventStatus,
  EventType,
  type BandEvent,
} from "@/modules/events/domain/event";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import {
  MemberStatus,
  type MemberFunction,
  type MemberInstrument,
  type Rank,
  type Section,
} from "@/modules/members/domain/member";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { OutboxHandlers } from "@/modules/outbox/application/outbox-handlers";
import type {
  OutboxDraft,
  OutboxMessage,
} from "@/modules/outbox/domain/outbox";
import {
  ROSTER_REPOSITORY,
  type EventAssignment,
  type MyAssignmentTab,
  type RosterRepositoryPort,
  type RosterSummary,
} from "@/modules/rosters/application/ports/roster-repository.port";
import {
  rosterNotice,
  swapDeclinedNotice,
  swapRequestNotice,
  type NoticeContext,
  type NoticeKind,
} from "@/modules/rosters/application/roster-notifications";
import {
  AckStatus,
  blockerOf,
  checkAssignments,
  DEFAULT_EVENT_DURATION_MS,
  diffAssignments,
  eventWindow,
  isEmptyDiff,
  mergeAcks,
  normalizeAssignments,
  reminderFor,
  RosterStatus,
  uncoveredSections,
  type Assignment,
  type AssignmentInput,
  type AssignmentProblem,
  type Blocker,
  type CandidateFacts,
  type Roster,
} from "@/modules/rosters/domain/roster";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { BandFunctionsUseCase } from "@/modules/band-functions/application/band-functions.use-cases";

export type Candidate = {
  userId: string;
  name: string;
  warName: string;
  rank: Rank;
  registration: string | null;
  phone: string | null;
  section: Section;
  memberStatus: MemberStatus;
  instruments: MemberInstrument[];
  functions: MemberFunction[];
  blocker: Blocker | null;
  absence: { type: AbsenceType; startsOn: string; endsOn: string } | null;
  busyWith: { eventId: string; title: string }[];
};

export type RosterView = Roster & { uncoveredSections: Section[] };

const MAX_ASSIGNMENTS = 150;

const BLOCKER_TEXT: Record<Blocker, string> = {
  "no-profile": "não tem cadastro ativo na banda",
  inactive: "está inativo",
  away: "está afastado",
  absent: "tem indisponibilidade aprovada no período",
};

const OPEN_STATUSES = [EventStatus.PLANEJADO, EventStatus.CONFIRMADO];

@Injectable()
export class RostersUseCase implements OnModuleInit {
  constructor(
    @Inject(ROSTER_REPOSITORY) private readonly rosters: RosterRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly events: EventsUseCase,
    private readonly venues: VenuesUseCase,
    private readonly members: MembersUseCase,
    private readonly absences: AbsencesUseCase,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
    private readonly handlers: OutboxHandlers,
    private readonly functions: BandFunctionsUseCase,
    private readonly users: UserLookupService,
  ) {}

  /** Status and size of the rosters of these events (lists of events). */
  summaries(eventIds: readonly string[]): Promise<Map<string, RosterSummary>> {
    return this.rosters.summaries(eventIds);
  }

  onModuleInit(): void {
    this.handlers.register(EVENT_CHANGED_TOPIC, (message) =>
      this.onEventChanged(message),
    );
  }

  /**
   * The roster as `viewer` may see it: managers (`canReadAll`) see drafts
   * too; others only a published roster they are on.
   */
  async view(
    viewer: AuthenticatedUser,
    eventId: string,
    canReadAll: boolean,
  ): Promise<RosterView | null> {
    const roster = await this.rosters.find(eventId);
    if (!roster) return null;
    // Published rosters: the whole band sees who goes (names, function and
    // "ciente"); drafts only who sees every roster.
    if (!canReadAll && roster.status !== RosterStatus.PUBLICADA) return null;
    const visible = canReadAll
      ? roster
      : {
          ...roster,
          // Someone else's swap reason or conflict justification is for the
          // managers; each member keeps their own.
          assignments: roster.assignments.map((item) =>
            item.userId === viewer.id
              ? item
              : { ...item, ackNote: null, overrideReason: null },
          ),
        };
    return { ...visible, uncoveredSections: await this.uncovered(roster) };
  }

  /** Everyone who could go, with what blocks or warns about each one. */
  async candidates(eventId: string): Promise<Candidate[]> {
    const event = await this.events.get(eventId);
    return this.candidatesFor(event);
  }

  myAssignments(
    userId: string,
    acknowledged?: boolean,
  ): Promise<EventAssignment[]> {
    return this.rosters.publishedAssignmentsOf(
      userId,
      this.myAssignmentsFrom(),
      acknowledged,
    );
  }

  /** The user's line on each of these events (published rosters only). */
  myLinesOn(
    userId: string,
    eventIds: readonly string[],
  ): Promise<Map<string, Assignment>> {
    return this.rosters.publishedLinesOn(userId, eventIds);
  }

  /** "Minhas escalas": one tab, one page at a time. */
  myAssignmentsPage(
    userId: string,
    tab: MyAssignmentTab,
    page: PageRequest,
  ): Promise<Paginated<EventAssignment>> {
    return this.rosters.publishedAssignmentsPage(
      userId,
      this.myAssignmentsFrom(),
      tab,
      page,
    );
  }

  myAssignmentCounts(userId: string): Promise<Record<MyAssignmentTab, number>> {
    return this.rosters.publishedAssignmentCounts(
      userId,
      this.myAssignmentsFrom(),
    );
  }

  // Started up to 12 h ago still shows (the event may be happening).
  private myAssignmentsFrom(): Date {
    return new Date(this.clock.now().getTime() - 12 * 3_600_000);
  }

  async save(
    actor: AuthenticatedUser,
    eventId: string,
    input: readonly AssignmentInput[],
  ): Promise<RosterView> {
    const event = await this.openEvent(eventId);
    const lines = normalizeAssignments(input);
    if (lines.length > MAX_ASSIGNMENTS) {
      throw AppException.from(APP_ERRORS.rosters.tooManyAssignments, undefined);
    }

    const candidates = await this.candidatesFor(event);
    const byUser = new Map(candidates.map((item) => [item.userId, item]));
    const functionNames = await this.functionNames();
    const problems = checkAssignments(
      lines,
      this.factsOf(candidates),
      new Set(functionNames.keys()),
    );
    if (problems.length > 0) throw this.problemError(problems, byUser);

    const current = await this.rosters.find(eventId);
    const before = current?.assignments ?? [];
    const assignments = mergeAcks(before, lines);
    const published = current?.status === RosterStatus.PUBLICADA;
    const diff = diffAssignments(before, assignments);
    const version =
      published && !isEmptyDiff(diff)
        ? current.version + 1
        : (current?.version ?? 0);

    // Published: tell only the people the change affects.
    const notices: OutboxDraft[] = [];
    if (published && !isEmptyDiff(diff)) {
      const context = await this.noticeContext(event, actor);
      const lineOf = (userId: string) =>
        this.noticeLine(assignments, byUser, userId, functionNames);
      const notify = (kind: NoticeKind, userIds: string[]) =>
        userIds.forEach((userId) =>
          notices.push(
            deliveryDraft(
              rosterNotice(kind, userId, lineOf(userId), context),
              `roster:${eventId}:v${version}:${userId}`,
            ),
          ),
        );
      notify("published", diff.added);
      notify("updated", diff.changed);
      notify("removed", diff.removed);
    }

    const roster = await this.rosters.save(
      eventId,
      {
        status: current?.status ?? RosterStatus.RASCUNHO,
        version,
        publishedAt: current?.publishedAt ?? null,
        publishedBy: current?.publishedBy ?? null,
        assignments,
      },
      notices,
    );
    if (notices.length > 0) this.outbox.kick();

    await this.audit.stamp({
      actorId: actor.id,
      entity: "roster",
      entityId: eventId,
      created: !current,
    });
    return { ...roster, uncoveredSections: await this.uncovered(roster) };
  }

  /**
   * The rosters of working days (expediente), already published, in one go.
   * Nobody is asked to acknowledge them and nobody is notified here: the
   * batch sends one notice per person. Whoever has an approved absence on a
   * day is left out of that day. Returns who is on each event.
   */
  async assignDutyMany(
    actor: AuthenticatedUser,
    events: readonly BandEvent[],
    input: readonly AssignmentInput[],
  ): Promise<Map<string, string[]>> {
    const lines = normalizeAssignments(input);
    const days = events.map((event) => ({
      event,
      day: this.clock.localDate(event.startsAt),
    }));
    const sorted = days.map((item) => item.day).sort();
    const absences =
      sorted.length > 0
        ? await this.absences.approvedDuring(
            lines.map((line) => line.userId),
            { startsOn: sorted[0]!, endsOn: sorted[sorted.length - 1]! },
          )
        : [];
    const away = (userId: string, day: string) =>
      absences.some(
        (item) =>
          item.userId === userId && item.startsOn <= day && item.endsOn >= day,
      );

    const publishedAt = this.clock.now();
    const people = new Map<string, string[]>();
    const rosters = days.map(({ event, day }) => {
      const onDay = lines.filter((line) => !away(line.userId, day));
      people.set(
        event.id,
        onDay.map((line) => line.userId),
      );
      return {
        eventId: event.id,
        state: {
          status: RosterStatus.PUBLICADA,
          version: 1,
          publishedAt,
          publishedBy: actor.id,
          assignments: onDay.map((line) => ({
            ...line,
            ackStatus: AckStatus.CIENTE,
            ackNote: null,
            ackAt: null,
          })),
        },
      };
    });
    await this.rosters.createMany(rosters);
    await this.audit.stampMany({
      actorId: actor.id,
      entity: "roster",
      entityIds: events.map((event) => event.id),
      created: true,
    });
    return people;
  }

  async publish(
    actor: AuthenticatedUser,
    eventId: string,
  ): Promise<RosterView> {
    const event = await this.openEvent(eventId);
    const current = await this.rosters.find(eventId);
    if (!current || current.assignments.length === 0) {
      throw AppException.from(APP_ERRORS.rosters.empty, undefined);
    }
    if (current.status === RosterStatus.PUBLICADA) {
      throw AppException.from(APP_ERRORS.rosters.alreadyPublished, undefined);
    }

    const candidates = await this.candidatesFor(event);
    const byUser = new Map(candidates.map((item) => [item.userId, item]));
    const functionNames = await this.functionNames();
    // Something may have changed since the draft was saved (new absence…).
    const problems = checkAssignments(
      current.assignments,
      this.factsOf(candidates),
      new Set(functionNames.keys()),
    ).filter((problem) => problem.kind === "blocked");
    if (problems.length > 0) throw this.problemError(problems, byUser);

    const version = current.version + 1;
    const context = await this.noticeContext(event, actor);
    const notices = current.assignments.map((item) =>
      deliveryDraft(
        rosterNotice(
          "published",
          item.userId,
          this.noticeLine(
            current.assignments,
            byUser,
            item.userId,
            functionNames,
          ),
          context,
        ),
        `roster:${eventId}:v${version}:${item.userId}`,
      ),
    );
    const roster = await this.rosters.save(
      eventId,
      {
        status: RosterStatus.PUBLICADA,
        version,
        publishedAt: this.clock.now(),
        publishedBy: actor.id,
        assignments: current.assignments,
      },
      notices,
    );
    this.outbox.kick();

    await this.audit.stamp({
      actorId: actor.id,
      entity: "roster",
      entityId: eventId,
    });
    return { ...roster, uncoveredSections: await this.uncovered(roster) };
  }

  /** The member answers: ciente, or asks to be replaced (with a reason). */
  async acknowledge(
    actor: AuthenticatedUser,
    eventId: string,
    status: AckStatus.CIENTE | AckStatus.TROCA_SOLICITADA,
    note: string | null,
  ): Promise<Assignment> {
    const event = await this.events.get(eventId);
    const roster = await this.rosters.find(eventId);
    const line = roster?.assignments.find((item) => item.userId === actor.id);
    if (!roster || roster.status !== RosterStatus.PUBLICADA || !line) {
      throw AppException.from(APP_ERRORS.rosters.notAssigned, undefined);
    }
    if (
      !OPEN_STATUSES.includes(event.status) ||
      eventWindow(event).to <= this.clock.now()
    ) {
      throw AppException.from(APP_ERRORS.rosters.eventClosed, undefined);
    }
    const reason = note?.trim() || null;
    if (status === AckStatus.TROCA_SOLICITADA && !reason) {
      throw AppException.from(APP_ERRORS.rosters.swapReasonRequired, undefined);
    }

    const at = this.clock.now();
    const notices: OutboxDraft[] = [];
    if (status === AckStatus.TROCA_SOLICITADA) {
      // Every manager (Gestor) and whoever published: anyone can solve it.
      const managers = new Set(
        await this.users.activeUserIdsInGroup(UserGroup.ADMIN),
      );
      if (roster.publishedBy) managers.add(roster.publishedBy);
      managers.delete(actor.id);
      const member = (await this.members.signatureOf(actor)) ?? actor.name;
      for (const managerId of managers) {
        notices.push(
          deliveryDraft(
            swapRequestNotice(managerId, member, reason as string, {
              event,
              venue: null,
              timeZone: this.clock.timeZone,
            }),
            `swap:${eventId}:${actor.id}:${at.getTime()}:${managerId}`,
          ),
        );
      }
    }
    await this.rosters.setAck(
      eventId,
      actor.id,
      { status, note: reason, at },
      notices,
    );
    if (notices.length > 0) this.outbox.kick();

    await this.audit.stamp({
      actorId: actor.id,
      entity: "roster",
      entityId: eventId,
    });
    return { ...line, ackStatus: status, ackNote: reason, ackAt: at };
  }

  /** Open swap requests of upcoming events (managers answer them). */
  swapRequests(page: PageRequest): Promise<Paginated<EventAssignment>> {
    return this.rosters.swapRequestsPage(this.myAssignmentsFrom(), page);
  }

  /**
   * The manager keeps the person on the roster (does not accept the swap):
   * the line goes back to waiting for their "ciente", and they are told why.
   */
  async keepOnRoster(
    actor: AuthenticatedUser,
    eventId: string,
    userId: string,
    note: string | null,
  ): Promise<Assignment> {
    // Like absences: nobody answers their own request.
    if (userId === actor.id) {
      throw AppException.from(APP_ERRORS.rosters.selfSwapReview, undefined);
    }
    const event = await this.openEvent(eventId);
    const roster = await this.rosters.find(eventId);
    const line = roster?.assignments.find((item) => item.userId === userId);
    if (
      roster?.status !== RosterStatus.PUBLICADA ||
      line?.ackStatus !== AckStatus.TROCA_SOLICITADA
    ) {
      throw AppException.from(APP_ERRORS.rosters.noSwapRequest, undefined);
    }
    const text = note?.trim() || null;
    const by = (await this.members.signatureOf(actor)) ?? actor.name;
    await this.rosters.setAck(
      eventId,
      userId,
      { status: AckStatus.PENDENTE, note: null, at: null },
      [
        deliveryDraft(
          swapDeclinedNotice(userId, by, text, {
            event,
            venue: null,
            timeZone: this.clock.timeZone,
          }),
          `swap-declined:${eventId}:${userId}:${this.clock.now().getTime()}`,
        ),
      ],
    );
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "roster",
      entityId: eventId,
    });
    return {
      ...line,
      ackStatus: AckStatus.PENDENTE,
      ackNote: null,
      ackAt: null,
    };
  }

  /**
   * Morning run (scheduled workflow): reminds everyone on the published
   * rosters of today's and tomorrow's events. Dedupe keys make a second run
   * on the same day harmless.
   */
  async sendReminders(): Promise<{ events: number; reminders: number }> {
    const now = this.clock.now();
    const today = this.clock.localDate(now);
    const tomorrowStart = this.clock.startOfNextLocalDay(now);
    const tomorrow = this.clock.localDate(tomorrowStart);
    const events = await this.events.list({
      from: this.clock.startOfLocalDate(today),
      to: this.clock.startOfNextLocalDay(tomorrowStart),
      statuses: OPEN_STATUSES,
    });

    let band: Awaited<ReturnType<MembersUseCase["bandMembers"]>> | null = null;
    let functionNames: Map<string, string> | null = null;
    let remindedEvents = 0;
    const drafts: OutboxDraft[] = [];
    for (const event of events) {
      // Working days come in batches the musicians already have.
      if (event.type === EventType.EXPEDIENTE) continue;
      const kind = reminderFor(
        {
          startsOnDay: this.clock.localDate(event.startsAt),
          window: eventWindow(event),
        },
        { today, tomorrow, now },
      );
      if (!kind) continue;
      const roster = await this.rosters.find(event.id);
      if (roster?.status !== RosterStatus.PUBLICADA) continue;
      if (roster.assignments.length === 0) continue;

      band ??= await this.members.bandMembers();
      functionNames ??= await this.functionNames();
      const byUser = new Map(
        band.map((entry) => [
          entry.userId,
          { instruments: entry.profile?.instruments ?? [] },
        ]),
      );
      const context = await this.noticeContext(event);
      remindedEvents += 1;
      for (const item of roster.assignments) {
        drafts.push(
          deliveryDraft(
            rosterNotice(
              kind === "today" ? "reminder-today" : "reminder-tomorrow",
              item.userId,
              this.noticeLine(
                roster.assignments,
                byUser,
                item.userId,
                functionNames,
              ),
              context,
            ),
            `reminder:${event.id}:${item.userId}:${kind}:${today}`,
          ),
        );
      }
    }
    await this.outbox.enqueue(drafts);
    return { events: remindedEvents, reminders: drafts.length };
  }

  /** Who is on the published roster of an event (for announcements). */
  async publishedAssignees(eventId: string): Promise<string[]> {
    const roster = await this.rosters.find(eventId);
    return roster?.status === RosterStatus.PUBLICADA
      ? roster.assignments.map((item) => item.userId)
      : [];
  }

  /** Outbox handler: tell everyone on a published roster about the change. */
  private async onEventChanged(message: OutboxMessage): Promise<void> {
    const { eventId, change, actorId } =
      message.payload as unknown as EventChange;
    const roster = await this.rosters.find(eventId);
    if (roster?.status !== RosterStatus.PUBLICADA) return;
    const event = await this.events.get(eventId);
    const context = await this.noticeContext(event, actorId ?? null);
    const candidates = await this.members.bandMembers();
    const byUser = new Map(
      candidates.map((entry) => [
        entry.userId,
        { instruments: entry.profile?.instruments ?? [] },
      ]),
    );
    const functionNames = await this.functionNames();
    const kind: NoticeKind =
      change === "CANCELLED" ? "cancelled" : "rescheduled";
    await this.outbox.enqueue(
      roster.assignments.map((item) =>
        deliveryDraft(
          rosterNotice(
            kind,
            item.userId,
            this.noticeLine(
              roster.assignments,
              byUser,
              item.userId,
              functionNames,
            ),
            context,
          ),
          // A retried handler does not notify twice.
          `${message.id}:${item.userId}`,
        ),
      ),
    );
    this.outbox.kick();
  }

  private async candidatesFor(event: BandEvent): Promise<Candidate[]> {
    const window = eventWindow(event);
    const band = await this.members.bandMembers();
    const userIds = band.map((entry) => entry.userId);
    const [absences, busy] = await Promise.all([
      this.absences.approvedDuring(userIds, {
        startsOn: this.clock.localDate(window.from),
        endsOn: this.clock.localDate(window.to),
      }),
      this.rosters.busyDuring(
        userIds,
        window,
        event.id,
        DEFAULT_EVENT_DURATION_MS,
      ),
    ]);

    return band.map((entry) => {
      const profile = entry.profile!;
      const absence =
        absences.find((item) => item.userId === entry.userId) ?? null;
      const busyWith = busy
        .filter((item) => item.userId === entry.userId)
        .map(({ eventId, title }) => ({ eventId, title }));
      const facts: CandidateFacts = {
        memberStatus: profile.status,
        instrumentIds: profile.instruments.map((item) => item.instrumentId),
        hasApprovedAbsence: absence !== null,
        busyWith,
      };
      return {
        userId: entry.userId,
        name: entry.name,
        warName: profile.warName,
        rank: profile.rank,
        registration: profile.registration,
        phone: profile.phone,
        section: profile.section,
        memberStatus: profile.status,
        instruments: profile.instruments,
        functions: profile.functions,
        blocker: blockerOf(facts),
        absence: absence && {
          type: absence.type,
          startsOn: absence.startsOn,
          endsOn: absence.endsOn,
        },
        busyWith,
      };
    });
  }

  private factsOf(candidates: Candidate[]): Map<string, CandidateFacts> {
    return new Map(
      candidates.map((item) => [
        item.userId,
        {
          memberStatus: item.memberStatus,
          instrumentIds: item.instruments.map((i) => i.instrumentId),
          hasApprovedAbsence: item.absence !== null,
          busyWith: item.busyWith,
        },
      ]),
    );
  }

  private problemError(
    problems: AssignmentProblem[],
    byUser: Map<string, Candidate>,
  ): AppException {
    const name = (userId: string) => byUser.get(userId)?.warName ?? "Alguém";
    const busy = problems.filter((item) => item.kind === "busy-needs-reason");
    if (busy.length === problems.length) {
      return AppException.from(
        APP_ERRORS.rosters.scheduleConflict,
        { names: busy.map((item) => name(item.userId)).join(", ") },
        { userIds: busy.map((item) => item.userId) },
      );
    }
    const first = problems.find((item) => item.kind !== "busy-needs-reason")!;
    const reason =
      first.kind === "blocked"
        ? `${name(first.userId)} ${BLOCKER_TEXT[first.blocker]}.`
        : first.kind === "unknown-function"
          ? `A função escolhida para ${name(first.userId)} não existe mais.`
          : `${name(first.userId)} não toca o instrumento escolhido (veja o cadastro do músico).`;
    return AppException.from(
      APP_ERRORS.rosters.invalidAssignment,
      { reason },
      { userIds: problems.map((item) => item.userId) },
    );
  }

  private async openEvent(eventId: string): Promise<BandEvent> {
    const event = await this.events.get(eventId);
    if (!OPEN_STATUSES.includes(event.status)) {
      throw AppException.from(APP_ERRORS.rosters.eventClosed, undefined);
    }
    return event;
  }

  /** `by`: who made the change (signed in the notice); null = automatic. */
  private async noticeContext(
    event: BandEvent,
    by: AuthenticatedUser | string | null = null,
  ): Promise<NoticeContext> {
    const [venue, signature] = await Promise.all([
      event.venueId
        ? this.venues
            .findMany([event.venueId])
            .then((venues) => venues[0] ?? null)
        : null,
      by ? this.members.signatureOf(by) : null,
    ]);
    return {
      event,
      venue,
      by: signature,
      timeZone: this.clock.timeZone,
      // Seconds since epoch: grows with every notice about this event.
      sequence: Math.floor(this.clock.now().getTime() / 1000),
    };
  }

  private noticeLine(
    assignments: readonly Assignment[],
    byUser: ReadonlyMap<string, { instruments: MemberInstrument[] }>,
    userId: string,
    functionNames: ReadonlyMap<string, string>,
  ) {
    const line = assignments.find((item) => item.userId === userId);
    if (!line) return null;
    const instrument = byUser
      .get(userId)
      ?.instruments.find((item) => item.instrumentId === line.instrumentId);
    return {
      functionName: line.functionId
        ? (functionNames.get(line.functionId) ?? null)
        : null,
      instrumentName: instrument?.name ?? null,
    };
  }

  /** Every function by id (archived too: old lines keep their name). */
  private async functionNames(): Promise<Map<string, string>> {
    const all = await this.functions.list(true);
    return new Map(all.map((item) => [item.id, item.name]));
  }

  private async uncovered(roster: Roster): Promise<Section[]> {
    const band = await this.members.bandMembers();
    const active = band.filter(
      (entry) => entry.profile?.status === MemberStatus.ATIVO,
    );
    const assigned = new Set(roster.assignments.map((item) => item.userId));
    return uncoveredSections(
      active.map((entry) => entry.profile!.section),
      active
        .filter((entry) => assigned.has(entry.userId))
        .map((entry) => entry.profile!.section),
    );
  }
}
