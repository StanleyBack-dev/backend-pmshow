export type RateRule = {
  /** Hits allowed in one window. */
  limit: number;
  windowMs: number;
};

/**
 * Whether a window already reached its limit, and how long until it resets
 * (whole minutes, at least 1).
 */
export function rateStatus(
  window: { count: number; resetAt: Date } | null,
  rule: RateRule,
  now: Date,
): { blocked: false } | { blocked: true; retryAfterMinutes: number } {
  if (!window || window.resetAt <= now || window.count < rule.limit) {
    return { blocked: false };
  }
  return {
    blocked: true,
    retryAfterMinutes: Math.max(
      1,
      Math.ceil((window.resetAt.getTime() - now.getTime()) / 60_000),
    ),
  };
}
