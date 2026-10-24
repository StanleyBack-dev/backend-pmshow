import type { MigrationInterface, QueryRunner } from "typeorm";

// Phase 4: outbox, notifications, absences and rosters.
export class CreateRostersNotifications1793400000000 implements MigrationInterface {
  name = "CreateRostersNotifications1793400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_outbox" (
        "idtb_outbox" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "topic" varchar(60) NOT NULL,
        "payload" jsonb NOT NULL,
        "dedupe_key" varchar(200),
        "status" varchar(8) NOT NULL DEFAULT 'PENDING'
          CHECK ("status" IN ('PENDING', 'DONE', 'FAILED')),
        "attempts" smallint NOT NULL DEFAULT 0,
        "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
        "locked_until" timestamptz,
        "last_error" varchar(1000),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_outbox_dedupe_key" ON "tb_outbox" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_outbox_due" ON "tb_outbox" ("next_attempt_at") WHERE "status" = 'PENDING'`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_notifications" (
        "idtb_notifications" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "type" varchar(32) NOT NULL,
        "title" varchar(160) NOT NULL,
        "body" varchar(1000) NOT NULL,
        "link" varchar(300),
        "source_id" uuid UNIQUE,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_notifications_user_created" ON "tb_notifications" ("idtb_users", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_notifications_unread" ON "tb_notifications" ("idtb_users") WHERE "read_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_notification_prefs" (
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "type" varchar(32) NOT NULL,
        "email_enabled" boolean NOT NULL,
        PRIMARY KEY ("idtb_users", "type")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tb_absences" (
        "idtb_absences" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "type" varchar(20) NOT NULL,
        "starts_on" date NOT NULL,
        "ends_on" date NOT NULL,
        "reason" varchar(500),
        "status" varchar(10) NOT NULL
          CHECK ("status" IN ('PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA')),
        "review_note" varchar(500),
        "reviewed_by" uuid,
        "reviewed_at" timestamptz,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CHECK ("ends_on" >= "starts_on")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_absences_period" ON "tb_absences" ("starts_on", "ends_on")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_absences_user" ON "tb_absences" ("idtb_users", "starts_on")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_rosters" (
        "idtb_events" uuid PRIMARY KEY
          REFERENCES "tb_events" ("idtb_events") ON DELETE CASCADE,
        "status" varchar(10) NOT NULL
          CHECK ("status" IN ('RASCUNHO', 'PUBLICADA')),
        "version" int NOT NULL DEFAULT 0,
        "published_at" timestamptz,
        "published_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tb_roster_assignments" (
        "idtb_events" uuid NOT NULL
          REFERENCES "tb_rosters" ("idtb_events") ON DELETE CASCADE,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "role" varchar(16) NOT NULL,
        "idtb_instruments" uuid REFERENCES "tb_instruments" ("idtb_instruments"),
        "notes" varchar(200),
        "override_reason" varchar(300),
        "ack_status" varchar(16) NOT NULL DEFAULT 'PENDENTE'
          CHECK ("ack_status" IN ('PENDENTE', 'CIENTE', 'TROCA_SOLICITADA')),
        "ack_note" varchar(300),
        "ack_at" timestamptz,
        PRIMARY KEY ("idtb_events", "idtb_users")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_roster_assignments_user" ON "tb_roster_assignments" ("idtb_users")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_roster_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_rosters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_absences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_notification_prefs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_outbox"`);
  }
}
