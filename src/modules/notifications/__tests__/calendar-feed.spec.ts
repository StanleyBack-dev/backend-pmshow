import { buildCalendarFeed } from "@/modules/notifications/domain/ics";

const entry = (uid: string, cancelled = false) => ({
  uid,
  sequence: 1,
  cancelled,
  start: new Date("2026-11-03T13:00:00Z"),
  end: new Date("2026-11-03T15:00:00Z"),
  summary: "PM SHOW · Desfile, 7 de setembro",
  location: "Praça Cívica — Goiânia/GO",
  description: null,
  url: "https://app.example/eventos/e1",
});

describe("buildCalendarFeed", () => {
  it("puts every event of the person in one calendar to subscribe to", () => {
    const ics = buildCalendarFeed(
      "PM SHOW · Fulano",
      [entry("event-1@pmshow"), entry("event-2@pmshow", true)],
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:PM SHOW · Fulano");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:event-1@pmshow");
    expect(ics).toContain("STATUS:CANCELLED");
    // Commas are escaped in text values.
    expect(ics).toContain("SUMMARY:PM SHOW · Desfile\\, 7 de setembro");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("is a valid empty calendar without events", () => {
    const ics = buildCalendarFeed("PM SHOW", [], new Date());
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});
