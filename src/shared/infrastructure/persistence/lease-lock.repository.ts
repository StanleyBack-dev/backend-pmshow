import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { LockPort } from "@/shared/application/ports/lock.port";

// Single atomic upsert, so it works through Neon's transaction-mode pooler
// (session advisory locks would not).
@Injectable()
export class LeaseLockRepository implements LockPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async tryAcquire(
    name: string,
    holder: string,
    leaseMs: number,
  ): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `INSERT INTO tb_locks (name, holder, lease_until)
       VALUES ($1, $2, now() + ($3::int * interval '1 millisecond'))
       ON CONFLICT (name) DO UPDATE
         SET holder = EXCLUDED.holder, lease_until = EXCLUDED.lease_until
         WHERE tb_locks.lease_until < now()
       RETURNING holder`,
      [name, holder, Math.round(leaseMs)],
    );
    return rows.length === 1;
  }

  async release(name: string, holder: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE tb_locks SET lease_until = now() - interval '1 second'
       WHERE name = $1 AND holder = $2`,
      [name, holder],
    );
  }
}
