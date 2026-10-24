// iCalendar (RFC 5545) for the e-mail attachment that puts an event in the
// musician's phone calendar. The UID is stable per event, so a later file
// with a higher SEQUENCE updates (or, with CANCEL, removes) the same entry.

export type CalendarEntry = {
  uid: string;
  sequence: number;
  cancelled: boolean;
  start: Date;
  end: Date;
  summary: string;
  location: string | null;
  description: string | null;
  url: string | null;
};

const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const escapeText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

const encoder = new TextEncoder();

/** Lines longer than 75 octets continue on the next line after a space. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation starts with " "
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(entry: CalendarEntry, now: Date): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PM SHOW//Escalas//PT-BR",
    "CALSCALE:GREGORIAN",
    `METHOD:${entry.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${entry.uid}`,
    `SEQUENCE:${entry.sequence}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(entry.start)}`,
    `DTEND:${stamp(entry.end)}`,
    `SUMMARY:${escapeText(entry.summary)}`,
    entry.location ? `LOCATION:${escapeText(entry.location)}` : null,
    entry.description ? `DESCRIPTION:${escapeText(entry.description)}` : null,
    entry.url ? `URL:${entry.url}` : null,
    `STATUS:${entry.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .filter((line): line is string => line !== null)
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
