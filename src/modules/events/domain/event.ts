import type { VenueAddress } from "@/modules/events/domain/venue-address";

export enum EventType {
  SHOW = "SHOW",
  DESFILE = "DESFILE",
  SOLENIDADE = "SOLENIDADE",
  FORMATURA = "FORMATURA",
  ENSAIO = "ENSAIO",
  CULTO_MISSA = "CULTO_MISSA",
  OUTRO = "OUTRO",
}

export enum EventStatus {
  PLANEJADO = "PLANEJADO",
  CONFIRMADO = "CONFIRMADO",
  REALIZADO = "REALIZADO",
  CANCELADO = "CANCELADO",
}

export type Venue = VenueAddress & {
  id: string;
  name: string;
  mapsUrl: string | null;
  notes: string | null;
  archived: boolean;
};

export type BandEvent = {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  /** When the band must be there (concentração). */
  callTime: Date | null;
  startsAt: Date;
  endsAt: Date | null;
  venueId: string | null;
  uniform: string | null;
  requester: string | null;
  /** Official document that requested the band (ofício, memorando…). */
  documentRef: string | null;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SetlistItem = {
  songId: string;
  position: number;
  notes: string | null;
};

export type Schedule = {
  callTime: Date | null;
  startsAt: Date;
  endsAt: Date | null;
};

export type ScheduleViolation =
  "ends-before-start" | "call-after-start" | "too-long";

/** An event lasts at most this long (a full-day parade is the extreme). */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
/** Call time can't be absurdly earlier than the start. */
const MAX_CALL_ADVANCE_MS = 12 * 60 * 60 * 1000;

export function checkSchedule(schedule: Schedule): ScheduleViolation[] {
  const violations: ScheduleViolation[] = [];
  const start = schedule.startsAt.getTime();
  if (schedule.endsAt) {
    const end = schedule.endsAt.getTime();
    if (end <= start) violations.push("ends-before-start");
    else if (end - start > MAX_DURATION_MS) violations.push("too-long");
  }
  if (schedule.callTime) {
    const call = schedule.callTime.getTime();
    if (call > start || start - call > MAX_CALL_ADVANCE_MS) {
      violations.push("call-after-start");
    }
  }
  return violations;
}

export type StatusDenial =
  | "same-status"
  | "not-happened-yet"
  | "cancelled-is-final-for-done"
  | "done-is-final"
  | "reason-required";

/**
 * Whether `from` → `to` is allowed. A done (REALIZADO) event is final; a
 * cancelled one can be reopened (back to PLANEJADO); an event can only be
 * marked done once it started; cancelling needs a reason.
 */
export function checkStatusChange(
  from: EventStatus,
  to: EventStatus,
  context: { startsAt: Date; now: Date; reason: string | null },
): StatusDenial | null {
  if (from === to) return "same-status";
  if (from === EventStatus.REALIZADO) return "done-is-final";
  if (to === EventStatus.REALIZADO) {
    if (from === EventStatus.CANCELADO) return "cancelled-is-final-for-done";
    if (context.startsAt > context.now) return "not-happened-yet";
  }
  if (to === EventStatus.CANCELADO && !context.reason?.trim()) {
    return "reason-required";
  }
  return null;
}

/** Only https links (Google Maps, Waze…) are kept for venues. */
export function normalizeMapsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Setlist positions 1..n in the given order, without repeated songs (the
 * first occurrence wins).
 */
export function normalizeSetlist(
  items: readonly { songId: string; notes?: string | null }[],
): SetlistItem[] {
  const seen = new Set<string>();
  const result: SetlistItem[] = [];
  for (const item of items) {
    if (seen.has(item.songId)) continue;
    seen.add(item.songId);
    result.push({
      songId: item.songId,
      position: result.length + 1,
      notes: item.notes?.trim() || null,
    });
  }
  return result;
}
