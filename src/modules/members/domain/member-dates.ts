// Birthday and the day the person joined the band: the home page lists the
// month's birthdays and the musicians' pages show how long each one has been
// in the band. Calendar dates (YYYY-MM-DD), no time zone.

export type BandDateViolation = "invalid" | "future" | "out-of-range";

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date (rejects 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
}

/** Whole years between two dates (YYYY-MM-DD). */
export function yearsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return ty! - fy! - (tm! < fm! || (tm === fm && td! < fd!) ? 1 : 0);
}

/** Birth date of a member: real, past, 14 to 100 years old. */
export function checkBirthDate(
  value: string,
  today: string,
): BandDateViolation | null {
  if (!isCalendarDate(value)) return "invalid";
  if (value > today) return "future";
  const age = yearsBetween(value, today);
  return age < 14 || age > 100 ? "out-of-range" : null;
}

/** When the member joined the band: real, not in the future, from 1950. */
export function checkJoinedOn(
  value: string,
  today: string,
): BandDateViolation | null {
  if (!isCalendarDate(value)) return "invalid";
  if (value > today) return "future";
  return value < "1950-01-01" ? "out-of-range" : null;
}

export const BIRTH_DATE_MESSAGES: Record<BandDateViolation, string> = {
  invalid: "Data de nascimento inválida.",
  future: "A data de nascimento não pode ser no futuro.",
  "out-of-range": "Confira a data de nascimento (idade entre 14 e 100 anos).",
};

export const JOINED_ON_MESSAGES: Record<BandDateViolation, string> = {
  invalid: "Data de ingresso na banda inválida.",
  future: "A data de ingresso não pode ser no futuro.",
  "out-of-range": "Confira a data de ingresso na banda.",
};
