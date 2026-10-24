import { buildIcs, foldLine } from "@/modules/notifications/domain/ics";
import {
  emailEnabled,
  NotificationType,
} from "@/modules/notifications/domain/notification";
import { MAX_ATTEMPTS, nextAttempt } from "@/modules/outbox/domain/outbox";

describe("emailEnabled", () => {
  it("is on unless the user turned it off", () => {
    const overrides = new Map([[NotificationType.ROSTER_UPDATED, false]]);
    expect(emailEnabled(NotificationType.ROSTER_PUBLISHED, overrides)).toBe(
      true,
    );
    expect(emailEnabled(NotificationType.ROSTER_UPDATED, overrides)).toBe(
      false,
    );
  });
});

describe("buildIcs", () => {
  const entry = {
    uid: "event-1@pmshow",
    sequence: 1793000000,
    cancelled: false,
    start: new Date("2026-11-15T20:30:00Z"),
    end: new Date("2026-11-16T00:00:00Z"),
    summary: "PM SHOW · Formatura, turma 2026",
    location: "Teatro; Goiânia",
    description: "Função: Músico\nUniforme: 1º",
    url: null,
  };
  const now = new Date("2026-11-01T12:00:00.123Z");

  it("builds a CRLF calendar with UTC times and escaped text", () => {
    const ics = buildIcs(entry, now);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n")).toEqual(
      expect.arrayContaining([
        "METHOD:PUBLISH",
        "UID:event-1@pmshow",
        "SEQUENCE:1793000000",
        "DTSTAMP:20261101T120000Z",
        "DTSTART:20261115T203000Z",
        "DTEND:20261116T000000Z",
        "SUMMARY:PM SHOW · Formatura\\, turma 2026",
        "LOCATION:Teatro\\; Goiânia",
        "DESCRIPTION:Função: Músico\\nUniforme: 1º",
        "STATUS:CONFIRMED",
      ]),
    );
    expect(ics).not.toContain("URL:");
  });

  it("a cancellation uses METHOD:CANCEL", () => {
    const ics = buildIcs({ ...entry, cancelled: true }, now);
    expect(ics).toContain("METHOD:CANCEL\r\n");
    expect(ics).toContain("STATUS:CANCELLED\r\n");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const folded = foldLine(`SUMMARY:${"á".repeat(60)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(parts.slice(1).every((part) => part.startsWith(" "))).toBe(true);
    expect(parts.map((part, i) => (i ? part.slice(1) : part)).join("")).toBe(
      `SUMMARY:${"á".repeat(60)}`,
    );
  });
});

describe("outbox nextAttempt", () => {
  const now = new Date("2026-11-01T12:00:00Z");

  it("backs off 1 min, 5 min, 30 min, 2 h, 6 h", () => {
    const delays = [1, 2, 3, 4, 5].map((attempts) => {
      const plan = nextAttempt(attempts, now);
      return plan === "give-up"
        ? null
        : (plan.retryAt.getTime() - now.getTime()) / 60_000;
    });
    expect(delays).toEqual([1, 5, 30, 120, 360]);
  });

  it("gives up after the last attempt", () => {
    expect(nextAttempt(MAX_ATTEMPTS, now)).toBe("give-up");
  });
});
