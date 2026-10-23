import {
  BPM_RANGE,
  inRange,
  normalizeMusicalKey,
  normalizeTags,
} from "@/modules/repertoire/domain/song";

describe("normalizeMusicalKey", () => {
  it.each([
    ["C", "C"],
    ["bb", "Bb"],
    ["Bb", "Bb"],
    ["f#m", "F#m"],
    ["F#M", "F#m"],
    [" a m ", "Am"],
    ["Ebm", "Ebm"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeMusicalKey(input)).toBe(expected);
  });

  it.each(["H", "C##", "Cmaj7", "X", "do", "#C"])("rejects %s", (input) => {
    expect(normalizeMusicalKey(input)).toBeNull();
  });
});

describe("normalizeTags", () => {
  it("trims, lowercases and removes duplicates and empties", () => {
    expect(
      normalizeTags([" Desfile ", "desfile", "", "Formatura  Militar"]),
    ).toEqual(["desfile", "formatura militar"]);
  });

  it("keeps at most 10 tags", () => {
    expect(
      normalizeTags(Array.from({ length: 15 }, (_, i) => `t${i}`)),
    ).toHaveLength(10);
  });
});

describe("inRange", () => {
  it("accepts integers inside the range only", () => {
    expect(inRange(120, BPM_RANGE)).toBe(true);
    expect(inRange(19, BPM_RANGE)).toBe(false);
    expect(inRange(120.5, BPM_RANGE)).toBe(false);
  });
});
