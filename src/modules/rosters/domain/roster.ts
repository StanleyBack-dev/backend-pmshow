import { MemberStatus } from "@/modules/members/domain/member";

// A roster (escala) says who goes to an event and in which function (none =
// musician) and instrument. One per event. Drafts are only seen by managers; publishing notifies everyone on
// it, and later edits notify only the people they affect.

export enum RosterStatus {
  RASCUNHO = "RASCUNHO",
  PUBLICADA = "PUBLICADA",
}

/** The member's answer to a published roster. */
export enum AckStatus {
  PENDENTE = "PENDENTE",
  CIENTE = "CIENTE",
  TROCA_SOLICITADA = "TROCA_SOLICITADA",
}

export type Assignment = {
  userId: string;
  /** Function in the band catalog (regente, motorista…); null = musician. */
  functionId: string | null;
  instrumentId: string | null;
  notes: string | null;
  /** Why the manager kept someone busy in another event at the same time. */
  overrideReason: string | null;
  ackStatus: AckStatus;
  ackNote: string | null;
  ackAt: Date | null;
};

export type Roster = {
  eventId: string;
  status: RosterStatus;
  /** Bumped on publish and on every published change (calendar SEQUENCE). */
  version: number;
  publishedAt: Date | null;
  publishedBy: string | null;
  assignments: Assignment[];
};

export type AssignmentInput = {
  userId: string;
  functionId?: string | null;
  instrumentId?: string | null;
  notes?: string | null;
  overrideReason?: string | null;
};

export type Window = { from: Date; to: Date };

/** Events without an end are assumed to take this long. */
export const DEFAULT_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;

/** From the call time (or start) to the end (or start + 3 h). */
export function eventWindow(event: {
  callTime: Date | null;
  startsAt: Date;
  endsAt: Date | null;
}): Window {
  return {
    from: event.callTime ?? event.startsAt,
    to:
      event.endsAt ??
      new Date(event.startsAt.getTime() + DEFAULT_EVENT_DURATION_MS),
  };
}

export function windowsOverlap(a: Window, b: Window): boolean {
  return a.from < b.to && b.from < a.to;
}

const text = (value: string | null | undefined) => value?.trim() || null;

/** One line per person (first wins), trimmed texts. */
export function normalizeAssignments(
  input: readonly AssignmentInput[],
): Required<AssignmentInput>[] {
  const seen = new Set<string>();
  const result: Required<AssignmentInput>[] = [];
  for (const item of input) {
    if (seen.has(item.userId)) continue;
    seen.add(item.userId);
    result.push({
      userId: item.userId,
      functionId: item.functionId ?? null,
      instrumentId: item.instrumentId ?? null,
      notes: text(item.notes),
      overrideReason: text(item.overrideReason),
    });
  }
  return result;
}

/** Why someone can't be on this roster at all. */
export type Blocker = "no-profile" | "inactive" | "away" | "absent";

/** What is known about a candidate for one event. */
export type CandidateFacts = {
  /** null = no band profile (or the account is disabled). */
  memberStatus: MemberStatus | null;
  instrumentIds: readonly string[];
  hasApprovedAbsence: boolean;
  /** Other events (not cancelled/done) at the same time this person is on. */
  busyWith: readonly { eventId: string; title: string }[];
};

export function blockerOf(facts: CandidateFacts): Blocker | null {
  if (facts.memberStatus === null) return "no-profile";
  if (facts.memberStatus === MemberStatus.INATIVO) return "inactive";
  if (facts.memberStatus === MemberStatus.AFASTADO) return "away";
  if (facts.hasApprovedAbsence) return "absent";
  return null;
}

export type AssignmentProblem =
  | { userId: string; kind: "blocked"; blocker: Blocker }
  | { userId: string; kind: "unknown-instrument" }
  | { userId: string; kind: "unknown-function" }
  | {
      userId: string;
      kind: "busy-needs-reason";
      events: readonly { eventId: string; title: string }[];
    };

/**
 * Blockers stop the save; a schedule conflict with another event is only a
 * warning, accepted when the manager gives a reason (it goes to the audit).
 */
export function checkAssignments(
  assignments: readonly Required<AssignmentInput>[],
  facts: ReadonlyMap<string, CandidateFacts>,
  /** Functions that exist (archived ones included: old lines keep them). */
  functionIds: ReadonlySet<string>,
): AssignmentProblem[] {
  const problems: AssignmentProblem[] = [];
  for (const item of assignments) {
    const known: CandidateFacts = facts.get(item.userId) ?? {
      memberStatus: null,
      instrumentIds: [],
      hasApprovedAbsence: false,
      busyWith: [],
    };
    const blocker = blockerOf(known);
    if (blocker) {
      problems.push({ userId: item.userId, kind: "blocked", blocker });
      continue;
    }
    if (item.instrumentId && !known.instrumentIds.includes(item.instrumentId)) {
      problems.push({ userId: item.userId, kind: "unknown-instrument" });
      continue;
    }
    if (item.functionId && !functionIds.has(item.functionId)) {
      problems.push({ userId: item.userId, kind: "unknown-function" });
      continue;
    }
    if (known.busyWith.length > 0 && !item.overrideReason) {
      problems.push({
        userId: item.userId,
        kind: "busy-needs-reason",
        events: known.busyWith,
      });
    }
  }
  return problems;
}

export type RosterDiff = {
  added: string[];
  removed: string[];
  /** Function or instrument changed. */
  changed: string[];
};

export function diffAssignments(
  before: readonly Pick<Assignment, "userId" | "functionId" | "instrumentId">[],
  after: readonly Pick<Assignment, "userId" | "functionId" | "instrumentId">[],
): RosterDiff {
  const old = new Map(before.map((item) => [item.userId, item]));
  const next = new Map(after.map((item) => [item.userId, item]));
  return {
    added: after.filter((item) => !old.has(item.userId)).map((i) => i.userId),
    removed: before
      .filter((item) => !next.has(item.userId))
      .map((item) => item.userId),
    changed: after
      .filter((item) => {
        const previous = old.get(item.userId);
        return (
          previous !== undefined &&
          (previous.functionId !== item.functionId ||
            previous.instrumentId !== item.instrumentId)
        );
      })
      .map((item) => item.userId),
  };
}

export const isEmptyDiff = (diff: RosterDiff) =>
  diff.added.length + diff.removed.length + diff.changed.length === 0;

/**
 * The new assignment list keeps each unchanged person's answer (ciente /
 * troca); new or changed lines start pending again.
 */
export function mergeAcks(
  before: readonly Assignment[],
  after: readonly Required<AssignmentInput>[],
): Assignment[] {
  const old = new Map(before.map((item) => [item.userId, item]));
  return after.map((item) => {
    const previous = old.get(item.userId);
    const unchanged =
      previous !== undefined &&
      previous.functionId === item.functionId &&
      previous.instrumentId === item.instrumentId;
    return {
      ...item,
      ackStatus: unchanged ? previous.ackStatus : AckStatus.PENDENTE,
      ackNote: unchanged ? previous.ackNote : null,
      ackAt: unchanged ? previous.ackAt : null,
    };
  });
}

/** Sections with active members but nobody on the roster. */
export function uncoveredSections<S extends string>(
  activeSections: readonly S[],
  assignedSections: readonly S[],
): S[] {
  const covered = new Set(assignedSections);
  return [...new Set(activeSections)].filter(
    (section) => !covered.has(section),
  );
}

/**
 * Which reminder an event gets on the morning run: "tomorrow" for events
 * starting tomorrow, "today" for today's events whose call time (or start)
 * hasn't passed yet. Days are calendar dates in the app timezone.
 */
export function reminderFor(
  event: { startsOnDay: string; window: Window },
  context: { today: string; tomorrow: string; now: Date },
): "today" | "tomorrow" | null {
  if (event.startsOnDay === context.tomorrow) return "tomorrow";
  if (event.startsOnDay === context.today && event.window.from > context.now) {
    return "today";
  }
  return null;
}
