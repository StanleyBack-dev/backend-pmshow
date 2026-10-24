import type { MigrationInterface, QueryRunner } from "typeorm";

// Phase 5: Web Push subscriptions and announcements (comunicados).
export class CreatePushBroadcasts1793500000000 implements MigrationInterface {
  name = "CreatePushBroadcasts1793500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_push_subscriptions" (
        "idtb_push_subscriptions" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "endpoint" varchar(1000) NOT NULL UNIQUE,
        "p256dh" varchar(200) NOT NULL,
        "auth" varchar(100) NOT NULL,
        "user_agent" varchar(300),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_used_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_push_subscriptions_user" ON "tb_push_subscriptions" ("idtb_users")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_broadcasts" (
        "idtb_broadcasts" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(120) NOT NULL,
        "body" varchar(2000) NOT NULL,
        "audience" varchar(16) NOT NULL
          CHECK ("audience" IN ('TODOS', 'NAIPE', 'ESCALA_EVENTO')),
        "section" varchar(16),
        "idtb_events" uuid REFERENCES "tb_events" ("idtb_events") ON DELETE SET NULL,
        "send_email" boolean NOT NULL,
        "recipients" int NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_broadcasts_created" ON "tb_broadcasts" ("created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_broadcasts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_push_subscriptions"`);
  }
}
