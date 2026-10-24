import { Inject, Injectable, Logger } from "@nestjs/common";
import { OutboxHandlers } from "@/modules/outbox/application/outbox-handlers";
import {
  OUTBOX_REPOSITORY,
  type OutboxRepositoryPort,
} from "@/modules/outbox/application/ports/outbox-repository.port";
import {
  nextAttempt,
  type OutboxDraft,
  type OutboxMessage,
} from "@/modules/outbox/domain/outbox";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const BATCH = 50;
/** A claimed message is retried by others if not settled within this. */
const LEASE_MS = 5 * 60_000;
const CONCURRENCY = 5;

export type DispatchReport = { processed: number; failed: number };

@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private running: Promise<DispatchReport> | null = null;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly handlers: OutboxHandlers,
  ) {}

  /** For handlers that fan out (no surrounding transaction). */
  enqueue(drafts: readonly OutboxDraft[]): Promise<void> {
    return this.outbox.enqueue(drafts);
  }

  /**
   * Best-effort delivery right after a commit. Whatever does not go out now
   * is picked up by the scheduled run (POST /internal/outbox/process).
   */
  kick(): void {
    void this.process().catch((error: unknown) =>
      this.logger.error(`Falha ao processar a outbox: ${String(error)}`),
    );
  }

  /** Delivers due messages until none is left (or a batch keeps failing). */
  process(): Promise<DispatchReport> {
    // One loop per instance; a second caller waits for the running one.
    this.running ??= this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async drain(): Promise<DispatchReport> {
    const report: DispatchReport = { processed: 0, failed: 0 };
    for (;;) {
      const batch = await this.outbox.claimDue(
        this.clock.now(),
        BATCH,
        LEASE_MS,
      );
      if (batch.length === 0) return report;

      let succeeded = 0;
      for (let index = 0; index < batch.length; index += CONCURRENCY) {
        const results = await Promise.all(
          batch
            .slice(index, index + CONCURRENCY)
            .map((message) => this.deliver(message)),
        );
        succeeded += results.filter(Boolean).length;
      }
      report.processed += succeeded;
      report.failed += batch.length - succeeded;
      // Everything failed: stop instead of spinning on a broken provider.
      // Otherwise keep going: handlers may have enqueued follow-ups (an
      // "event.changed" fans out into one delivery per person).
      if (succeeded === 0) return report;
    }
  }

  private async deliver(message: OutboxMessage): Promise<boolean> {
    const handler = this.handlers.for(message.topic);
    if (!handler) {
      await this.outbox.markFailed(message.id, "no handler for this topic");
      this.logger.error(`Outbox: tópico sem handler "${message.topic}"`);
      return false;
    }
    try {
      await handler(message);
      await this.outbox.markDone(message.id, this.clock.now());
      return true;
    } catch (error) {
      const reason = String(error).slice(0, 1000);
      const plan = nextAttempt(message.attempts, this.clock.now());
      if (plan === "give-up") {
        await this.outbox.markFailed(message.id, reason);
        this.logger.error(
          `Outbox: ${message.topic} ${message.id} desistiu após ${message.attempts} tentativas: ${reason}`,
        );
      } else {
        await this.outbox.markRetry(message.id, plan.retryAt, reason);
        this.logger.warn(
          `Outbox: ${message.topic} ${message.id} falhou (tentativa ${message.attempts}); nova tentativa às ${plan.retryAt.toISOString()}`,
        );
      }
      return false;
    }
  }
}
