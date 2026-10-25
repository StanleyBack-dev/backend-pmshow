import type { MigrationInterface, QueryRunner } from "typeorm";

// Artists become their own records (songs point to them) and songs get a
// stage: NOVA (to learn) or CONHECIDA (already played). Existing free-text
// artist names turn into artists, one per spelling ignoring case/accents.
export class CreateArtistsSongStage1793700000000 implements MigrationInterface {
  name = "CreateArtistsSongStage1793700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_artists" (
        "idtb_artists" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "name_key" varchar(120) NOT NULL UNIQUE,
        "archived" boolean NOT NULL DEFAULT false,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Same key as artistKey() in the domain: no accents, lower case, single
    // spaces, trimmed.
    const key = (column: string) =>
      `lower(unaccent(regexp_replace(trim(${column}), '[[:space:]]+', ' ', 'g')))`;

    await queryRunner.query(`
      INSERT INTO "tb_artists" ("name", "name_key")
      SELECT DISTINCT ON (${key("artist")})
             left(regexp_replace(trim(artist), '[[:space:]]+', ' ', 'g'), 120),
             left(${key("artist")}, 120)
        FROM "tb_songs"
       WHERE artist IS NOT NULL AND length(trim(artist)) >= 2
       ORDER BY ${key("artist")}, artist
    `);

    await queryRunner.query(`
      ALTER TABLE "tb_songs"
        ADD COLUMN "idtb_artists" uuid
          REFERENCES "tb_artists" ("idtb_artists") ON DELETE SET NULL,
        ADD COLUMN "stage" varchar(10) NOT NULL DEFAULT 'CONHECIDA'
          CHECK ("stage" IN ('NOVA', 'CONHECIDA'))
    `);
    await queryRunner.query(`
      UPDATE "tb_songs" s
         SET "idtb_artists" = a."idtb_artists"
        FROM "tb_artists" a
       WHERE s.artist IS NOT NULL
         AND a.name_key = left(${key("s.artist")}, 120)
    `);
    await queryRunner.query(`ALTER TABLE "tb_songs" DROP COLUMN "artist"`);
    await queryRunner.query(
      `CREATE INDEX "ix_songs_artist" ON "tb_songs" ("idtb_artists")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_songs" ADD COLUMN "artist" varchar(160)`,
    );
    await queryRunner.query(`
      UPDATE "tb_songs" s SET "artist" = a."name"
        FROM "tb_artists" a WHERE a."idtb_artists" = s."idtb_artists"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_songs_artist"`);
    await queryRunner.query(
      `ALTER TABLE "tb_songs" DROP COLUMN "idtb_artists", DROP COLUMN "stage"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_artists"`);
  }
}
