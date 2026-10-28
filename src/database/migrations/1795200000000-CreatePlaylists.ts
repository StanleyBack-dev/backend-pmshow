import type { MigrationInterface, QueryRunner } from "typeorm";

// Playlists of the repertoire (rehearsal mode): the songs in play order.
export class CreatePlaylists1795200000000 implements MigrationInterface {
  name = "CreatePlaylists1795200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_playlists" (
        "idtb_playlists" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "name" varchar(80) NOT NULL,
        "description" varchar(300),
        "shared" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_playlists_owner" ON "tb_playlists" ("owner_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_playlists_shared" ON "tb_playlists" ("shared") WHERE "shared"`,
    );
    await queryRunner.query(`
      CREATE TABLE "tb_playlist_songs" (
        "idtb_playlists" uuid NOT NULL
          REFERENCES "tb_playlists" ("idtb_playlists") ON DELETE CASCADE,
        "position" integer NOT NULL CHECK ("position" > 0),
        "idtb_songs" uuid NOT NULL
          REFERENCES "tb_songs" ("idtb_songs") ON DELETE CASCADE,
        PRIMARY KEY ("idtb_playlists", "position")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_playlist_songs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_playlists"`);
  }
}
