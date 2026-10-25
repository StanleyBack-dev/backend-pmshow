import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type {
  AckStatus,
  Assignment,
  Roster,
  RosterStatus,
  Window,
} from "@/modules/rosters/domain/roster";

export type BusyEntry = { userId: string; eventId: string; title: string };

export type EventAssignment = Assignment & { eventId: string };

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
    ack: { status: AckStatus; note: string | null; at: Date },
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
  /** The user's lines on published rosters of events starting after `from`. */
  publishedAssignmentsOf(
    userId: string,
    from: Date,
  ): Promise<EventAssignment[]>;
}

export const ROSTER_REPOSITORY = Symbol("ROSTER_REPOSITORY");
