// Fixed-window counters shared by every serverless instance (stored in the
// database, so a limit holds across cold starts and parallel invocations).

export type RateWindow = {
  /** Hits in the current window, including this one (for `hit`). */
  count: number;
  /** When the current window ends and the counter starts over. */
  resetAt: Date;
};

export interface RateLimitPort {
  /** Counts one hit for `key` and returns the window after it. */
  hit(key: string, windowMs: number): Promise<RateWindow>;
  /** The current window without counting (null = nothing recorded). */
  peek(key: string, windowMs: number): Promise<RateWindow | null>;
  /** Removes windows that ended before `before` (maintenance). */
  purgeEndedBefore(before: Date): Promise<number>;
}

export const RATE_LIMIT = Symbol("RATE_LIMIT");
