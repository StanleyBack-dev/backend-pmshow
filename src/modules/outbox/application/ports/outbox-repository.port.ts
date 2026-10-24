import type {
  OutboxDraft,
  OutboxMessage,
} from "@/modules/outbox/domain/outbox";

export interface OutboxRepositoryPort {
  /** Outside a transaction (e.g. from a handler fanning out). */
  enqueue(drafts: readonly OutboxDraft[]): Promise<void>;
  /**
   * Leases up to `limit` due messages so concurrent dispatchers never take
   * the same one, and counts the attempt.
   */
  claimDue(now: Date, limit: number, leaseMs: number): Promise<OutboxMessage[]>;
  markDone(id: string, at: Date): Promise<void>;
  markRetry(id: string, retryAt: Date, error: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

export const OUTBOX_REPOSITORY = Symbol("OUTBOX_REPOSITORY");
