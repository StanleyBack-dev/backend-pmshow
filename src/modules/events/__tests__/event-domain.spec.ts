import {
  checkSchedule,
  checkStatusChange,
  EventStatus,
  normalizeMapsUrl,
  normalizeSetlist,
} from "@/modules/events/domain/event";

const at = (time: string) => new Date(`2026-11-15T${time}:00-03:00`);

describe("checkSchedule", () => {
  it("accepts call time before start and end after start", () => {
    expect(
      checkSchedule({
        callTime: at("17:30"),
        startsAt: at("19:00"),
        endsAt: at("21:00"),
      }),
    ).toEqual([]);
  });

  it("accepts an event with only a start", () => {
    expect(
      checkSchedule({ callTime: null, startsAt: at("19:00"), endsAt: null }),
    ).toEqual([]);
  });

  it("rejects an end at or before the start", () => {
    expect(
      checkSchedule({
        callTime: null,
        startsAt: at("19:00"),
        endsAt: at("19:00"),
      }),
    ).toEqual(["ends-before-start"]);
  });

  it("rejects events longer than a day", () => {
    expect(
      checkSchedule({
        callTime: null,
        startsAt: at("08:00"),
        endsAt: new Date(at("08:00").getTime() + 25 * 3_600_000),
      }),
    ).toEqual(["too-long"]);
  });

  it("rejects a call time after the start or absurdly early", () => {
    expect(
      checkSchedule({
        callTime: at("19:30"),
        startsAt: at("19:00"),
        endsAt: null,
      }),
    ).toEqual(["call-after-start"]);
    expect(
      checkSchedule({
        callTime: at("05:00"),
        startsAt: at("19:00"),
        endsAt: null,
      }),
    ).toEqual(["call-after-start"]);
  });
});

describe("checkStatusChange", () => {
  const past = { startsAt: at("19:00"), now: at("22:00"), reason: null };
  const future = { startsAt: at("19:00"), now: at("10:00"), reason: null };

  it("allows confirming, cancelling with a reason and reopening", () => {
    expect(
      checkStatusChange(EventStatus.PLANEJADO, EventStatus.CONFIRMADO, future),
    ).toBeNull();
    expect(
      checkStatusChange(EventStatus.CONFIRMADO, EventStatus.CANCELADO, {
        ...future,
        reason: "Chuva",
      }),
    ).toBeNull();
    expect(
      checkStatusChange(EventStatus.CANCELADO, EventStatus.PLANEJADO, future),
    ).toBeNull();
  });

  it("requires a reason to cancel", () => {
    expect(
      checkStatusChange(EventStatus.PLANEJADO, EventStatus.CANCELADO, {
        ...future,
        reason: "  ",
      }),
    ).toBe("reason-required");
  });

  it("marks as done only after the start, never from cancelled", () => {
    expect(
      checkStatusChange(EventStatus.CONFIRMADO, EventStatus.REALIZADO, future),
    ).toBe("not-happened-yet");
    expect(
      checkStatusChange(EventStatus.CONFIRMADO, EventStatus.REALIZADO, past),
    ).toBeNull();
    expect(
      checkStatusChange(EventStatus.CANCELADO, EventStatus.REALIZADO, past),
    ).toBe("cancelled-is-final-for-done");
  });

  it("treats done as final and rejects no-op changes", () => {
    expect(
      checkStatusChange(EventStatus.REALIZADO, EventStatus.PLANEJADO, past),
    ).toBe("done-is-final");
    expect(
      checkStatusChange(EventStatus.PLANEJADO, EventStatus.PLANEJADO, past),
    ).toBe("same-status");
  });
});

describe("normalizeMapsUrl", () => {
  it("keeps https links only", () => {
    expect(normalizeMapsUrl(" https://maps.app.goo.gl/abc ")).toBe(
      "https://maps.app.goo.gl/abc",
    );
    expect(normalizeMapsUrl("http://maps.google.com")).toBeNull();
    expect(normalizeMapsUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeMapsUrl("praça cívica")).toBeNull();
  });
});

describe("normalizeSetlist", () => {
  it("numbers positions in order and drops repeated songs", () => {
    expect(
      normalizeSetlist([
        { songId: "a", notes: " abertura " },
        { songId: "b" },
        { songId: "a" },
        { songId: "c", notes: "" },
      ]),
    ).toEqual([
      { songId: "a", position: 1, notes: "abertura" },
      { songId: "b", position: 2, notes: null },
      { songId: "c", position: 3, notes: null },
    ]);
  });
});
