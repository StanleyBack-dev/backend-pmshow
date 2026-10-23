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
