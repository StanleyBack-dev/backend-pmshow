import { MemberStatus, type Section } from "@/modules/members/domain/member";
import type { EventUniform } from "@/modules/events/domain/event";

// An expediente: the band's working days for a week or a month. Each day is
// an event (type EXPEDIENTE) with its roster already published; the batch
// remembers who it was for and tells each person once.

export enum DutyAudienceKind {
  /** Everyone active in the band. */
  ALL = "ALL",
  SECTIONS = "SECTIONS",
  MEMBERS = "MEMBERS",
}

export enum DutyScheduleStatus {
  ATIVA = "ATIVA",
  CANCELADA = "CANCELADA",
}

export type DutyAudience = {
  kind: DutyAudienceKind;
  sections: Section[];
  userIds: string[];
};

export type DutyDay = { startsAt: Date; endsAt: Date };

export type DutySchedule = {
  id: string;
  title: string;
  /** Local dates (YYYY-MM-DD) of the first and last working day. */
  startsOn: string;
  endsOn: string;
  venueId: string;
  uniform: EventUniform;
  notes: string | null;
  audienceKind: DutyAudienceKind;
  sections: Section[];
  status: DutyScheduleStatus;
  cancellationReason: string | null;
  eventIds: string[];
  userIds: string[];
  createdAt: Date;
};

/** At most a month of working days per batch. */
export const MAX_DUTY_DAYS = 31;
/** A working day lasts at most this long (it may end after midnight). */
const MAX_DAY_MS = 24 * 60 * 60 * 1000;

export type DutyDayProblem =
  | "no-days"
  | "too-many-days"
  | "ends-before-start"
  | "too-long"
  | "same-day-twice"
  | "span-too-long";

/**
 * The days must start on different dates (local), each end after it starts
 * (within 24 h) and all fit in about a month.
 */
export function checkDutyDays(
  days: readonly DutyDay[],
  localDate: (date: Date) => string,
): DutyDayProblem | null {
  if (days.length === 0) return "no-days";
  if (days.length > MAX_DUTY_DAYS) return "too-many-days";
  const dates = new Set<string>();
  for (const day of days) {
    const length = day.endsAt.getTime() - day.startsAt.getTime();
    if (length <= 0) return "ends-before-start";
    if (length > MAX_DAY_MS) return "too-long";
    const date = localDate(day.startsAt);
    if (dates.has(date)) return "same-day-twice";
    dates.add(date);
  }
  const sorted = [...dates].sort();
  const span =
    (Date.parse(`${sorted[sorted.length - 1]}T00:00:00Z`) -
      Date.parse(`${sorted[0]}T00:00:00Z`)) /
    MAX_DAY_MS;
  return span >= MAX_DUTY_DAYS ? "span-too-long" : null;
}

/** Who the batch is for: active members of the band that match. */
export function audienceOf(
  members: readonly {
    userId: string;
    section: Section;
    status: MemberStatus;
  }[],
  audience: DutyAudience,
): string[] {
  const sections = new Set(audience.sections);
  const chosen = new Set(audience.userIds);
  return members
    .filter((member) => member.status === MemberStatus.ATIVO)
    .filter((member) =>
      audience.kind === DutyAudienceKind.SECTIONS
        ? sections.has(member.section)
        : audience.kind === DutyAudienceKind.MEMBERS
          ? chosen.has(member.userId)
          : true,
    )
    .map((member) => member.userId);
}
