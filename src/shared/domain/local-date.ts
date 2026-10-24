// Timezone-aware calendar helpers built only on Intl (no date library, no
// framework) so both the domain and the infrastructure can use them.

export function toLocalDate(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant a calendar date (YYYY-MM-DD) starts in the timezone. */
export function startOfLocalDate(localDate: string, timeZone: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  const naiveMidnightUtc = Date.UTC(year, month - 1, day);
  const offset = timeZoneOffsetMs(new Date(naiveMidnightUtc), timeZone);
  return new Date(naiveMidnightUtc - offset);
}

export function startOfNextLocalDay(date: Date, timeZone: string): Date {
  const [year, month, day] = toLocalDate(date, timeZone).split("-").map(Number);
  const naiveMidnightUtc = Date.UTC(year, month - 1, day + 1);
  const offset = timeZoneOffsetMs(new Date(naiveMidnightUtc), timeZone);
  return new Date(naiveMidnightUtc - offset);
}

/** Whether `value` is a real calendar date written as YYYY-MM-DD. */
export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Days from `from` to `to` (both YYYY-MM-DD), e.g. same day = 0. */
export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  });
  return Math.round((b - a) / 86_400_000);
}

/** YYYY-MM-DD → DD/MM/YYYY. */
export function formatLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split("-");
  return `${day}/${month}/${year}`;
}

/** e.g. "sáb., 15/11/2026, 19:00" in the timezone. */
export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "HH:mm" in the timezone. */
export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
