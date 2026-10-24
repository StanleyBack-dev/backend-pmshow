import { rateStatus } from "@/shared/domain/rate-limit";

const now = new Date("2026-11-15T12:00:00Z");
const rule = { limit: 3, windowMs: 15 * 60_000 };
const window = (count: number, resetInMs: number) => ({
  count,
  resetAt: new Date(now.getTime() + resetInMs),
});

describe("rateStatus", () => {
  it("allows when nothing was recorded", () => {
    expect(rateStatus(null, rule, now)).toEqual({ blocked: false });
  });

  it("allows below the limit", () => {
    expect(rateStatus(window(2, 60_000), rule, now)).toEqual({
      blocked: false,
    });
  });

  it("blocks at the limit and says when to retry (rounded up)", () => {
    expect(rateStatus(window(3, 90_000), rule, now)).toEqual({
      blocked: true,
      retryAfterMinutes: 2,
    });
  });

  it("never asks to wait less than a minute", () => {
    expect(rateStatus(window(5, 1_000), rule, now)).toEqual({
      blocked: true,
      retryAfterMinutes: 1,
    });
  });

  it("a window that already ended no longer blocks", () => {
    expect(rateStatus(window(10, 0), rule, now)).toEqual({ blocked: false });
  });
});
