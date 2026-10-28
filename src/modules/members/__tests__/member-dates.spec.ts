import {
  checkBirthDate,
  checkJoinedOn,
  isCalendarDate,
  yearsBetween,
} from "@/modules/members/domain/member-dates";

const TODAY = "2026-10-28";

describe("member dates", () => {
  it("accepts only real calendar dates", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("28/10/2026")).toBe(false);
  });

  it("counts whole years", () => {
    expect(yearsBetween("1990-10-28", TODAY)).toBe(36);
    expect(yearsBetween("1990-10-29", TODAY)).toBe(35);
  });

  it("checks the birth date", () => {
    expect(checkBirthDate("1990-05-12", TODAY)).toBeNull();
    expect(checkBirthDate("2027-01-01", TODAY)).toBe("future");
    expect(checkBirthDate("2020-01-01", TODAY)).toBe("out-of-range");
    expect(checkBirthDate("", TODAY)).toBe("invalid");
  });

  it("checks the band start date", () => {
    expect(checkJoinedOn("2015-03-01", TODAY)).toBeNull();
    expect(checkJoinedOn(TODAY, TODAY)).toBeNull();
    expect(checkJoinedOn("2026-12-01", TODAY)).toBe("future");
    expect(checkJoinedOn("1949-12-31", TODAY)).toBe("out-of-range");
  });
});
