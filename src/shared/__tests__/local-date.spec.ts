import { startOfNextLocalDay, toLocalDate } from "@/shared/domain/local-date";

describe("local-date", () => {
  it("uses the app timezone to decide the calendar day", () => {
    // 01:30 UTC is still the previous day in São Paulo (UTC-3).
    expect(
      toLocalDate(new Date("2026-10-03T01:30:00Z"), "America/Sao_Paulo"),
    ).toBe("2026-10-02");
  });

  it("returns local midnight of the next day", () => {
    expect(
      startOfNextLocalDay(
        new Date("2026-10-02T15:00:00Z"),
        "America/Sao_Paulo",
      ).toISOString(),
    ).toBe("2026-10-03T03:00:00.000Z");
  });
});
