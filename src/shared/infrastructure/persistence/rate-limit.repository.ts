import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  RateLimitPort,
  RateWindow,
} from "@/shared/application/ports/rate-limit.port";

type Row = { hits: number; window_start: Date };

const toWindow = (row: Row, windowMs: number): RateWindow => ({
  count: row.hits,
  resetAt: new Date(row.window_start.getTime() + windowMs),
});

// One atomic upsert per hit: a window that already ended starts over at 1.
// Keys never carry raw personal data (callers hash IPs and logins).
@Injectable()
export class RateLimitRepository implements RateLimitPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async hit(key: string, windowMs: number): Promise<RateWindow> {
    const rows = await this.dataSource.query<Row[]>(
      `INSERT INTO tb_rate_limits (key, window_start, hits)
       VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE
           WHEN tb_rate_limits.window_start <= now() - ($2::int * interval '1 millisecond')
           THEN 1 ELSE tb_rate_limits.hits + 1 END,
         window_start = CASE
           WHEN tb_rate_limits.window_start <= now() - ($2::int * interval '1 millisecond')
           THEN now() ELSE tb_rate_limits.window_start END
       RETURNING hits, window_start`,
      [key, Math.round(windowMs)],
    );
    return toWindow(rows[0], windowMs);
  }

  async peek(key: string, windowMs: number): Promise<RateWindow | null> {
    const rows = await this.dataSource.query<Row[]>(
      `SELECT hits, window_start FROM tb_rate_limits WHERE key = $1`,
      [key],
    );
    return rows[0] ? toWindow(rows[0], windowMs) : null;
  }

  async purgeEndedBefore(before: Date): Promise<number> {
    // Windows are at most a day long: anything that started a day before
    // `before` has ended.
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `DELETE FROM tb_rate_limits WHERE window_start < $1::timestamptz - interval '1 day'`,
      [before],
    );
    return affected ?? 0;
  }
}
