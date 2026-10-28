import {
  ALERT_WINDOW_MS,
  alertKey,
  clip,
} from "@/modules/system-logs/domain/system-log";

describe("system log alerts", () => {
  const event = { category: "API" as const, source: "GraphQL events" };
  const start = new Date(
    Math.ceil(Date.now() / ALERT_WINDOW_MS) * ALERT_WINDOW_MS,
  );

  it("repeats the key inside the same window", () => {
    const later = new Date(start.getTime() + ALERT_WINDOW_MS - 1);
    expect(alertKey(event, start)).toBe(alertKey(event, later));
  });

  it("changes the key in the next window and per source", () => {
    const next = new Date(start.getTime() + ALERT_WINDOW_MS);
    expect(alertKey(event, start)).not.toBe(alertKey(event, next));
    expect(alertKey(event, start)).not.toBe(
      alertKey({ ...event, source: "POST /x" }, start),
    );
  });

  it("clips long texts", () => {
    expect(clip("abcdef", 4)).toBe("abc…");
    expect(clip("abc", 4)).toBe("abc");
  });
});
