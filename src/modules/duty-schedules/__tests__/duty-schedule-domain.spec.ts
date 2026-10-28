import {
  audienceOf,
  checkDutyDays,
  DutyAudienceKind,
} from "@/modules/duty-schedules/domain/duty-schedule";
import { MemberStatus, Section } from "@/modules/members/domain/member";

const at = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`);
const day = (date: string, from = "08:00", to = "17:00") => ({
  startsAt: at(date, from),
  endsAt: at(date, to),
});
const localDate = (date: Date) =>
  new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

describe("checkDutyDays", () => {
  it("accepts a working week", () => {
    expect(
      checkDutyDays(
        ["2026-11-02", "2026-11-03", "2026-11-04"].map((d) => day(d)),
        localDate,
      ),
    ).toBeNull();
  });

  it("needs at least one day", () => {
    expect(checkDutyDays([], localDate)).toBe("no-days");
  });

  it("refuses a day that ends before it starts", () => {
    expect(
      checkDutyDays([day("2026-11-02", "17:00", "08:00")], localDate),
    ).toBe("ends-before-start");
  });

  it("accepts a night that ends the next morning", () => {
    expect(
      checkDutyDays(
        [
          {
            startsAt: at("2026-11-02", "22:00"),
            endsAt: at("2026-11-03", "06:00"),
          },
        ],
        localDate,
      ),
    ).toBeNull();
  });

  it("refuses the same date twice", () => {
    expect(
      checkDutyDays(
        [day("2026-11-02"), day("2026-11-02", "18:00", "20:00")],
        localDate,
      ),
    ).toBe("same-day-twice");
  });

  it("covers at most 31 calendar days", () => {
    expect(
      checkDutyDays([day("2026-11-01"), day("2026-12-02")], localDate),
    ).toBe("span-too-long");
    expect(
      checkDutyDays([day("2027-01-01"), day("2027-01-31")], localDate),
    ).toBeNull();
  });
});

describe("audienceOf", () => {
  const band = [
    { userId: "a", section: Section.METAIS, status: MemberStatus.ATIVO },
    { userId: "b", section: Section.PERCUSSAO, status: MemberStatus.ATIVO },
    { userId: "c", section: Section.METAIS, status: MemberStatus.AFASTADO },
  ];

  it("everyone active for the whole band", () => {
    expect(
      audienceOf(band, {
        kind: DutyAudienceKind.ALL,
        sections: [],
        userIds: [],
      }),
    ).toEqual(["a", "b"]);
  });

  it("only the chosen sections", () => {
    expect(
      audienceOf(band, {
        kind: DutyAudienceKind.SECTIONS,
        sections: [Section.METAIS],
        userIds: [],
      }),
    ).toEqual(["a"]);
  });

  it("only the chosen members, still active", () => {
    expect(
      audienceOf(band, {
        kind: DutyAudienceKind.MEMBERS,
        sections: [],
        userIds: ["b", "c"],
      }),
    ).toEqual(["b"]);
  });
});
