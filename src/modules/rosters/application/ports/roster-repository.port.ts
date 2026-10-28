import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import type {
  AckStatus,
  Assignment,
  Roster,
  RosterStatus,
  Window,
} from "@/modules/rosters/domain/roster";

export type BusyEntry = { userId: string; eventId: string; title: string };

export type EventAssignment = Assignment & { eventId: string };

/** The tabs of "Minhas escalas": events by answer, and working days. */
export type MyAssignmentTab = "pending" | "acknowledged" | "duty";

export type RosterState = {
  status: RosterStatus;
  version: number;
  publishedAt: Date | null;
  publishedBy: string | null;
  assignments: Assignment[];
};

/** Status and size of an event's roster (lists of events). */
export type RosterSummary = { status: RosterStatus; assignments: number };

export interface RosterRepositoryPort {
  find(eventId: string): Promise<Roster | null>;
  summaries(eventIds: readonly string[]): Promise<Map<string, RosterSummary>>;
  /**
   * Creates or replaces the roster and its assignments, and stores the
   * notifications, in one transaction.
   */
  save(
    eventId: string,
    state: RosterState,
    notifications: readonly OutboxDraft[],
  ): Promise<Roster>;
  setAck(
    eventId: string,
    userId: string,
    ack: { status: AckStatus; note: string | null; at: Date | null },
    notifications: readonly OutboxDraft[],
  ): Promise<void>;
  /**
   * Who of `userIds` is on another planned/confirmed event overlapping the
   * window (default duration for events without an end: `defaultDurationMs`).
   */
  busyDuring(
    userIds: readonly string[],
    window: Window,
    excludeEventId: string,
    defaultDurationMs: number,
  ): Promise<BusyEntry[]>;
  /**
   * The user's lines on published rosters of events starting after `from`;
   * `acknowledged` true keeps only "ciente", false everything else.
   */
  publishedAssignmentsOf(
    userId: string,
    from: Date,
    acknowledged?: boolean,
  ): Promise<EventAssignment[]>;
  /** Same lines, one page at a time (by start, soonest first). */
  publishedAssignmentsPage(
    userId: string,
    from: Date,
    tab: MyAssignmentTab,
    page: PageRequest,
  ): Promise<Paginated<EventAssignment>>;
  /** Many new rosters (and their lines) in one transaction. */
  createMany(
    rosters: readonly { eventId: string; state: RosterState }[],
  ): Promise<void>;
  /** The user's line on the published roster of each of these events. */
  publishedLinesOn(
    userId: string,
    eventIds: readonly string[],
  ): Promise<Map<string, Assignment>>;
  /**
   * Open swap requests: lines asking to be replaced on published rosters of
   * planned/confirmed events starting after `from` (soonest first).
   */
  swapRequestsPage(
    from: Date,
    page: PageRequest,
  ): Promise<Paginated<EventAssignment>>;
  /** How many of those lines each tab has. */
  publishedAssignmentCounts(
    userId: string,
    from: Date,
  ): Promise<Record<MyAssignmentTab, number>>;
}

export const ROSTER_REPOSITORY = Symbol("ROSTER_REPOSITORY");
