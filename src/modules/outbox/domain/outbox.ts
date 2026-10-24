// Transactional outbox: a fact that must reach other modules (or the outside
// world) is stored in the same transaction as the change that caused it,
// then delivered by the dispatcher. A delivery that fails is retried with
// backoff, so nothing is lost when the e-mail provider is down.

export enum OutboxStatus {
  PENDING = "PENDING",
  DONE = "DONE",
  FAILED = "FAILED",
}

export type OutboxMessage = {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  /** Deliveries tried so far, including the one in progress. */
  attempts: number;
  createdAt: Date;
};

/** What a producer hands to the outbox. */
export type OutboxDraft = {
  topic: string;
  payload: Record<string, unknown>;
  /** Same key twice = the second draft is ignored (idempotent producers). */
  dedupeKey?: string;
};

/** Waits between attempts: 1 min, 5 min, 30 min, 2 h, 6 h. */
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000];

export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/**
 * After a failed attempt: when to try again, or give up once every delay
 * has been used.
 */
export function nextAttempt(
  attempts: number,
  now: Date,
): { retryAt: Date } | "give-up" {
  if (attempts >= MAX_ATTEMPTS) return "give-up";
  const delay = RETRY_DELAYS_MS[Math.max(attempts - 1, 0)];
  return { retryAt: new Date(now.getTime() + delay) };
}
