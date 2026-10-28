import type { MigrationInterface, QueryRunner } from "typeorm";

// Expedientes: a batch of working days (one EXPEDIENTE event each), with the
// days and the people it was launched for.
export class CreateDutySchedules1794700000000 implements MigrationInterface {
  name = "CreateDutySchedules1794700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_duty_schedules" (
        "idtb_duty_schedules" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(120) NOT NULL,
        "starts_on" date NOT NULL,
        "ends_on" date NOT NULL,
        "idtb_venues" uuid NOT NULL REFERENCES "tb_venues" ("idtb_venues"),
        "uniform" varchar(24) NOT NULL,
        "notes" varchar(1000),
        "audience_kind" varchar(10) NOT NULL
          CHECK ("audience_kind" IN ('ALL', 'SECTIONS', 'MEMBERS')),
        "sections" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" varchar(10) NOT NULL DEFAULT 'ATIVA'
          CHECK ("status" IN ('ATIVA', 'CANCELADA')),
        "cancellation_reason" varchar(300),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CHECK ("ends_on" >= "starts_on")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_duty_schedules_starts_on" ON "tb_duty_schedules" ("starts_on" DESC)`,
    );
    await queryRunner.query(`
      CREATE TABLE "tb_duty_schedule_events" (
        "idtb_duty_schedules" uuid NOT NULL
          REFERENCES "tb_duty_schedules" ("idtb_duty_schedules") ON DELETE CASCADE,
        "idtb_events" uuid NOT NULL UNIQUE
          REFERENCES "tb_events" ("idtb_events") ON DELETE CASCADE,
        PRIMARY KEY ("idtb_duty_schedules", "idtb_events")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tb_duty_schedule_members" (
        "idtb_duty_schedules" uuid NOT NULL
          REFERENCES "tb_duty_schedules" ("idtb_duty_schedules") ON DELETE CASCADE,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        PRIMARY KEY ("idtb_duty_schedules", "idtb_users")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_duty_schedule_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_duty_schedule_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_duty_schedules"`);
  }
}
