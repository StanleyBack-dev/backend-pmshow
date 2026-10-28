import { daysBetween, isLocalDate } from "@/shared/domain/local-date";

// A period a member can't be put on a roster. Requested by the member and
// approved by a manager, or registered by a manager directly (already
// approved). Only approved absences block the roster.

export enum AbsenceType {
  FERIAS = "FERIAS",
  LICENCA = "LICENCA",
  DISPENSA_MEDICA = "DISPENSA_MEDICA",
  MISSAO = "MISSAO",
  CURSO = "CURSO",
  OUTRO = "OUTRO",
}

export enum AbsenceStatus {
  PENDENTE = "PENDENTE",
  APROVADA = "APROVADA",
  RECUSADA = "RECUSADA",
  CANCELADA = "CANCELADA",
}

export type Absence = {
  id: string;
  userId: string;
  type: AbsenceType;
  /** Calendar dates (YYYY-MM-DD), both inclusive. */
  startsOn: string;
  endsOn: string;
  reason: string | null;
  status: AbsenceStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

export type Period = { startsOn: string; endsOn: string };

export type PeriodViolation = "invalid-date" | "ends-before-start" | "too-long";

/** A year and a day: covers any leave a manager would register at once. */
const MAX_DAYS = 366;

export function checkPeriod(period: Period): PeriodViolation | null {
  if (!isLocalDate(period.startsOn) || !isLocalDate(period.endsOn)) {
    return "invalid-date";
  }
  const days = daysBetween(period.startsOn, period.endsOn);
  if (days < 0) return "ends-before-start";
  if (days >= MAX_DAYS) return "too-long";
  return null;
}

/** Whether two inclusive date ranges share at least one day. */
export function periodsOverlap(a: Period, b: Period): boolean {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
}

/** Still counts: pending or approved. */
export const isOpen = (absence: Pick<Absence, "status">) =>
  absence.status === AbsenceStatus.PENDENTE ||
  absence.status === AbsenceStatus.APROVADA;

/**
 * Managers cancel any open absence; members cancel their own while pending,
 * or an approved one that has not ended yet.
 */
export function canCancel(
  absence: Pick<Absence, "status" | "endsOn">,
  context: { isOwner: boolean; isManager: boolean; today: string },
): boolean {
  if (!isOpen(absence)) return false;
  if (context.isManager) return true;
  if (!context.isOwner) return false;
  return (
    absence.status === AbsenceStatus.PENDENTE || absence.endsOn >= context.today
  );
}
