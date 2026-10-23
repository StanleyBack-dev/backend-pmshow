import type { MigrationInterface, QueryRunner } from "typeorm";

// Phase 2: band profiles (members + instruments), repertoire and media.
export class CreateMembersRepertoireMedia1793200000000 implements MigrationInterface {
  name = "CreateMembersRepertoireMedia1793200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Accent-insensitive search ("cancao" finds "canção").
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

    // === instruments ===
    await queryRunner.query(`
      CREATE TABLE "tb_instruments" (
        "idtb_instruments" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(60) NOT NULL,
        "section" varchar(16) NOT NULL,
        "archived" boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_instruments_name_lower" ON "tb_instruments" (lower("name"))`,
    );
    await queryRunner.query(`
      INSERT INTO "tb_instruments" ("name", "section") VALUES
        ('Flauta', 'MADEIRAS'),
        ('Clarinete', 'MADEIRAS'),
        ('Saxofone alto', 'MADEIRAS'),
        ('Saxofone tenor', 'MADEIRAS'),
        ('Saxofone barítono', 'MADEIRAS'),
        ('Trompete', 'METAIS'),
        ('Trombone', 'METAIS'),
        ('Trompa', 'METAIS'),
        ('Bombardino', 'METAIS'),
        ('Tuba', 'METAIS'),
        ('Bateria', 'PERCUSSAO'),
        ('Percussão', 'PERCUSSAO'),
        ('Guitarra', 'CORDAS_BASE'),
        ('Contrabaixo', 'CORDAS_BASE'),
        ('Teclado', 'CORDAS_BASE'),
        ('Violão', 'CORDAS_BASE'),
        ('Voz', 'VOCAL'),
        ('Técnico de som', 'TECNICA'),
        ('Técnico de luz', 'TECNICA'),
        ('Motorista', 'APOIO'),
        ('Apoio de palco', 'APOIO')
    `);

    // === members (1:1 with tb_users) ===
    await queryRunner.query(`
      CREATE TABLE "tb_members" (
        "idtb_users" uuid PRIMARY KEY
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "war_name" varchar(60) NOT NULL,
        "rank" varchar(24) NOT NULL,
        "registration" varchar(20),
        "phone" varchar(11),
        "section" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL,
        "notes" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_members_registration" ON "tb_members" ("registration") WHERE "registration" IS NOT NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "tb_member_instruments" (
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_members" ("idtb_users") ON DELETE CASCADE,
        "idtb_instruments" uuid NOT NULL
          REFERENCES "tb_instruments" ("idtb_instruments"),
        "is_primary" boolean NOT NULL DEFAULT false,
        PRIMARY KEY ("idtb_users", "idtb_instruments")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_member_instruments_instrument" ON "tb_member_instruments" ("idtb_instruments")`,
    );

    // === songs ===
    await queryRunner.query(`
      CREATE TABLE "tb_songs" (
        "idtb_songs" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(160) NOT NULL,
        "artist" varchar(160),
        "arranger" varchar(160),
        "category" varchar(24) NOT NULL,
        "musical_key" varchar(4),
        "bpm" smallint CHECK ("bpm" BETWEEN 20 AND 300),
        "duration_seconds" int CHECK ("duration_seconds" BETWEEN 1 AND 3600),
        "lyrics" text,
        "notes" varchar(1000),
        "tags" text[] NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_songs_active_title" ON "tb_songs" ("title") WHERE "archived_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_songs_tags" ON "tb_songs" USING gin ("tags")`,
    );

    // === media ===
    await queryRunner.query(`
      CREATE TABLE "tb_media_assets" (
        "idtb_media_assets" uuid PRIMARY KEY,
        "idtb_songs" uuid NOT NULL
          REFERENCES "tb_songs" ("idtb_songs") ON DELETE CASCADE,
        "kind" varchar(8) NOT NULL CHECK ("kind" IN ('AUDIO', 'VIDEO')),
        "status" varchar(8) NOT NULL CHECK ("status" IN ('PENDING', 'READY')),
        "title" varchar(160) NOT NULL,
        "storage_key" varchar(255),
        "mime_type" varchar(64),
        "size_bytes" bigint,
        "duration_seconds" int,
        "youtube_video_id" varchar(11),
        "thumbnail_url" varchar(500),
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CHECK (
          ("kind" = 'AUDIO' AND "storage_key" IS NOT NULL)
          OR ("kind" = 'VIDEO' AND "youtube_video_id" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_media_assets_song_status" ON "tb_media_assets" ("idtb_songs", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_media_assets_song_video" ON "tb_media_assets" ("idtb_songs", "youtube_video_id") WHERE "youtube_video_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_media_assets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_songs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_member_instruments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_instruments"`);
  }
}
