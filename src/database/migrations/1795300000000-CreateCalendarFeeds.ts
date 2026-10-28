import type { MigrationInterface, QueryRunner } from "typeorm";

// Each person's secret agenda link (iCal subscription): one per account.
export class CreateCalendarFeeds1795300000000 implements MigrationInterface {
  name = "CreateCalendarFeeds1795300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_calendar_feeds" (
        "idtb_users" uuid PRIMARY KEY
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "token" varchar(64) NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_calendar_feeds"`);
  }
}
