import {
  normalizeInstrumentSelection,
  normalizePhone,
  normalizeRegistration,
  normalizeWarName,
} from "@/modules/members/domain/member";

describe("normalizePhone", () => {
  it.each([
    ["(62) 99999-1234", "62999991234"],
    ["+55 62 3201-1234", "6232011234"],
    ["62999991234", "62999991234"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["99999-1234", "123", "+1 555 123 4567 89"])(
    "rejects %s",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe("normalizeRegistration", () => {
  it("keeps letters and digits in uppercase", () => {
    expect(normalizeRegistration(" 12.345-x ")).toBe("12345X");
  });

  it("rejects too short or too long values", () => {
    expect(normalizeRegistration("1-2")).toBeNull();
    expect(normalizeRegistration("1".repeat(21))).toBeNull();
  });
});

describe("normalizeWarName", () => {
  it("uppercases and collapses spaces", () => {
    expect(normalizeWarName("  sgt   silva ")).toBe("SGT SILVA");
  });
});

describe("normalizeInstrumentSelection", () => {
  it("makes the first instrument primary when none is", () => {
    expect(
      normalizeInstrumentSelection([
        { instrumentId: "a", primary: false },
        { instrumentId: "b", primary: false },
      ]),
    ).toEqual([
      { instrumentId: "a", primary: true },
      { instrumentId: "b", primary: false },
    ]);
  });

  it("drops duplicates", () => {
    expect(
      normalizeInstrumentSelection([
        { instrumentId: "a", primary: true },
        { instrumentId: "a", primary: false },
      ]),
    ).toEqual([{ instrumentId: "a", primary: true }]);
  });

  it("refuses two primaries", () => {
    expect(
      normalizeInstrumentSelection([
        { instrumentId: "a", primary: true },
        { instrumentId: "b", primary: true },
      ]),
    ).toBe("multiple-primary");
  });

  it("accepts an empty selection", () => {
    expect(normalizeInstrumentSelection([])).toEqual([]);
  });
});
