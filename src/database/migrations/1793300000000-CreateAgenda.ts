import type { MigrationInterface, QueryRunner } from "typeorm";

// Phase 3: venues, events and per-event setlists.
export class CreateAgenda1793300000000 implements MigrationInterface {
  name = "CreateAgenda1793300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_venues" (
        "idtb_venues" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "address" varchar(255),
        "city" varchar(80) NOT NULL,
        "maps_url" varchar(500),
        "notes" varchar(500),
        "archived" boolean NOT NULL DEFAULT false
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tb_events" (
        "idtb_events" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(160) NOT NULL,
        "type" varchar(16) NOT NULL,
        "status" varchar(12) NOT NULL
          CHECK ("status" IN ('PLANEJADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO')),
        "call_time" timestamptz,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz,
        "idtb_venues" uuid REFERENCES "tb_venues" ("idtb_venues"),
        "uniform" varchar(160),
        "requester" varchar(160),
        "document_ref" varchar(80),
        "notes" varchar(2000),
        "cancellation_reason" varchar(500),
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
        CHECK ("call_time" IS NULL OR "call_time" <= "starts_at")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_events_starts_at" ON "tb_events" ("starts_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_event_songs" (
        "idtb_events" uuid NOT NULL
          REFERENCES "tb_events" ("idtb_events") ON DELETE CASCADE,
        "idtb_songs" uuid NOT NULL
          REFERENCES "tb_songs" ("idtb_songs") ON DELETE CASCADE,
        "position" smallint NOT NULL CHECK ("position" > 0),
        "notes" varchar(200),
        PRIMARY KEY ("idtb_events", "idtb_songs"),
        UNIQUE ("idtb_events", "position")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_event_songs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_venues"`);
  }
}
