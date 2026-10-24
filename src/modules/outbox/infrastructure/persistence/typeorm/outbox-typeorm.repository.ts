import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import type { OutboxRepositoryPort } from "@/modules/outbox/application/ports/outbox-repository.port";
import {
  OutboxStatus,
  type OutboxDraft,
  type OutboxMessage,
} from "@/modules/outbox/domain/outbox";
import { OutboxMessageOrmEntity } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-message.orm-entity";

type ClaimedRow = {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  attempts: number;
  created_at: Date;
};

// Producers' repositories call this inside their own transaction, so the
// message is stored if and only if the change is.
@Injectable()
export class OutboxTypeormWriter {
  async write(
    manager: EntityManager,
    drafts: readonly OutboxDraft[],
  ): Promise<void> {
    if (drafts.length === 0) return;
    await manager
      .createQueryBuilder()
      .insert()
      .into(OutboxMessageOrmEntity)
      .values(
        drafts.map((draft): QueryDeepPartialEntity<OutboxMessageOrmEntity> => ({
          topic: draft.topic,
          // jsonb: TypeORM's deep-partial type can't describe free JSON.
          payload: draft.payload as QueryDeepPartialEntity<
            Record<string, unknown>
          >,
          dedupeKey: draft.dedupeKey ?? null,
        })),
      )
      // A repeated dedupe key means the message already exists.
      .orIgnore()
      .execute();
  }
}

@Injectable()
export class OutboxTypeormRepository implements OutboxRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly writer: OutboxTypeormWriter,
  ) {}

  enqueue(drafts: readonly OutboxDraft[]): Promise<void> {
    return this.writer.write(this.dataSource.manager, drafts);
  }

  async claimDue(
    now: Date,
    limit: number,
    leaseMs: number,
  ): Promise<OutboxMessage[]> {
    // node-postgres returns [rows, affected] for UPDATE … RETURNING.
    const [rows] = await this.dataSource.query<[ClaimedRow[], number]>(
      `UPDATE tb_outbox o
          SET attempts = o.attempts + 1, locked_until = $2
        WHERE o.idtb_outbox IN (
              SELECT idtb_outbox FROM tb_outbox
               WHERE status = 'PENDING' AND next_attempt_at <= $1
                 AND (locked_until IS NULL OR locked_until <= $1)
               ORDER BY created_at
               LIMIT $3
               FOR UPDATE SKIP LOCKED)
    RETURNING o.idtb_outbox AS id, o.topic, o.payload, o.attempts, o.created_at`,
      [now, new Date(now.getTime() + leaseMs), limit],
    );
    return rows
      .map((row) => ({
        id: row.id,
        topic: row.topic,
        payload: row.payload,
        attempts: row.attempts,
        createdAt: row.created_at,
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async markDone(id: string, at: Date): Promise<void> {
    await this.repository().update(id, {
      status: OutboxStatus.DONE,
      processedAt: at,
      lockedUntil: null,
      lastError: null,
    });
  }

  async markRetry(id: string, retryAt: Date, error: string): Promise<void> {
    await this.repository().update(id, {
      nextAttemptAt: retryAt,
      lockedUntil: null,
      lastError: error,
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.repository().update(id, {
      status: OutboxStatus.FAILED,
      lockedUntil: null,
      lastError: error,
    });
  }

  async purgeDeliveredBefore(before: Date): Promise<number> {
    const result = await this.repository()
      .createQueryBuilder()
      .delete()
      .where("status = :done AND processed_at < :before", {
        done: OutboxStatus.DONE,
        before,
      })
      .execute();
    return result.affected ?? 0;
  }

  private repository() {
    return this.dataSource.getRepository(OutboxMessageOrmEntity);
  }
}
