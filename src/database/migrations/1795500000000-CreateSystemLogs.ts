import type { MigrationInterface, QueryRunner } from "typeorm";

// The system log (Administração → Logs): errors, security events, failed
// routines and notices, kept for 90 days.
export class CreateSystemLogs1795500000000 implements MigrationInterface {
  name = "CreateSystemLogs1795500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_system_logs" (
        "idtb_system_logs" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "level" varchar(10) NOT NULL
          CHECK ("level" IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
        "category" varchar(12) NOT NULL,
        "source" varchar(200) NOT NULL,
        "message" varchar(1000) NOT NULL,
        "details" jsonb,
        "idtb_users" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "ip" varchar(64),
        "status_code" integer,
        "duration_ms" integer,
        "environment" varchar(20) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_system_logs_created" ON "tb_system_logs" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_system_logs_level_created" ON "tb_system_logs" ("level", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_system_logs_category_created" ON "tb_system_logs" ("category", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_system_logs"`);
  }
}
