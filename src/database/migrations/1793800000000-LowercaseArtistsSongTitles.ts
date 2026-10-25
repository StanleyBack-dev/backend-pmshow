import type { MigrationInterface, QueryRunner } from "typeorm";

// Singer / band names and song titles are stored in lowercase from now on;
// this converts the existing rows. The original capitalization is not kept.
export class LowercaseArtistsSongTitles1793800000000 implements MigrationInterface {
  name = "LowercaseArtistsSongTitles1793800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE tb_artists SET name = lower(name)`);
    await queryRunner.query(`UPDATE tb_songs SET title = lower(title)`);
  }

  public async down(): Promise<void> {
    // Lowercasing loses the original capitalization: nothing to restore.
  }
}
