import {
  AbsenceStatus,
  canCancel,
  checkPeriod,
  isOpen,
  periodsOverlap,
} from "@/modules/availability/domain/absence";

describe("checkPeriod", () => {
  it("accepts a single day and a normal range", () => {
    expect(checkPeriod({ startsOn: "2026-11-10", endsOn: "2026-11-10" })).toBe(
      null,
    );
    expect(checkPeriod({ startsOn: "2026-12-20", endsOn: "2027-01-10" })).toBe(
      null,
    );
  });

  it.each([
    ["2026-02-30", "2026-03-01"],
    ["2026-13-01", "2026-13-02"],
    ["10/11/2026", "2026-11-12"],
  ])("rejects the invalid date %s", (startsOn, endsOn) => {
    expect(checkPeriod({ startsOn, endsOn })).toBe("invalid-date");
  });

  it("rejects an end before the start", () => {
    expect(checkPeriod({ startsOn: "2026-11-10", endsOn: "2026-11-09" })).toBe(
      "ends-before-start",
    );
  });

  it("rejects more than a year", () => {
    expect(checkPeriod({ startsOn: "2026-01-01", endsOn: "2027-01-01" })).toBe(
      null,
    );
    expect(checkPeriod({ startsOn: "2026-01-01", endsOn: "2027-01-02" })).toBe(
      "too-long",
    );
  });
});

describe("periodsOverlap", () => {
  const nov = { startsOn: "2026-11-10", endsOn: "2026-11-20" };

  it("shares a day at the edges (inclusive dates)", () => {
    expect(
      periodsOverlap(nov, { startsOn: "2026-11-20", endsOn: "2026-11-25" }),
    ).toBe(true);
    expect(
      periodsOverlap(nov, { startsOn: "2026-11-01", endsOn: "2026-11-10" }),
    ).toBe(true);
  });

  it("adjacent periods do not overlap", () => {
    expect(
      periodsOverlap(nov, { startsOn: "2026-11-21", endsOn: "2026-11-25" }),
    ).toBe(false);
  });
});

describe("canCancel", () => {
  const today = "2026-11-15";
  const owner = { isOwner: true, isManager: false, today };

  it("owner cancels a pending request", () => {
    expect(
      canCancel(
        { status: AbsenceStatus.PENDENTE, endsOn: "2026-11-01" },
        owner,
      ),
    ).toBe(true);
  });

  it("owner cancels an approved absence only until it ends", () => {
    expect(
      canCancel(
        { status: AbsenceStatus.APROVADA, endsOn: "2026-11-15" },
        owner,
      ),
    ).toBe(true);
    expect(
      canCancel(
        { status: AbsenceStatus.APROVADA, endsOn: "2026-11-14" },
        owner,
      ),
    ).toBe(false);
  });

  it("someone else's absence needs a manager", () => {
    const other = { isOwner: false, isManager: false, today };
    expect(
      canCancel(
        { status: AbsenceStatus.PENDENTE, endsOn: "2026-12-01" },
        other,
      ),
    ).toBe(false);
    expect(
      canCancel(
        { status: AbsenceStatus.APROVADA, endsOn: "2026-01-01" },
        { ...other, isManager: true },
      ),
    ).toBe(true);
  });

  it("closed absences can't be cancelled", () => {
    for (const status of [AbsenceStatus.RECUSADA, AbsenceStatus.CANCELADA]) {
      expect(isOpen({ status })).toBe(false);
      expect(
        canCancel(
          { status, endsOn: "2026-12-01" },
          { ...owner, isManager: true },
        ),
      ).toBe(false);
    }
  });
});
