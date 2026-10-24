import type { MigrationInterface, QueryRunner } from "typeorm";

// Phase 6: fixed-window counters for per-IP limits on the auth endpoints.
// Keys hold only HMACs, never a raw IP.
export class CreateRateLimits1793600000000 implements MigrationInterface {
  name = "CreateRateLimits1793600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_rate_limits" (
        "key" varchar(200) PRIMARY KEY,
        "window_start" timestamptz NOT NULL,
        "hits" int NOT NULL CHECK ("hits" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_rate_limits_window" ON "tb_rate_limits" ("window_start")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_rate_limits"`);
  }
}
