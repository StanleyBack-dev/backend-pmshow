import type { MigrationInterface, QueryRunner } from "typeorm";

// "Músico" becomes a function like the others: roster lines without a
// function get it, and so does every member who plays an instrument.
export class MusicianFunction1794600000000 implements MigrationInterface {
  name = "MusicianFunction1794600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "tb_band_functions" ("name") VALUES ('Músico')
       ON CONFLICT ((lower("name"))) DO NOTHING`,
    );
    const musician = `(SELECT idtb_band_functions FROM tb_band_functions
      WHERE lower(name) = lower('Músico'))`;
    await queryRunner.query(
      `UPDATE tb_roster_assignments SET idtb_band_functions = ${musician}
        WHERE idtb_band_functions IS NULL`,
    );
    await queryRunner.query(`
      INSERT INTO "tb_member_functions" ("idtb_users", "idtb_band_functions")
      SELECT DISTINCT mi.idtb_users, ${musician}
        FROM tb_member_instruments mi
      ON CONFLICT DO NOTHING
    `);
  }

  // Lines go back to "no function" (= musician); the catalog entry stays
  // only if something else still uses it.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const musician = `(SELECT idtb_band_functions FROM tb_band_functions
      WHERE lower(name) = lower('Músico'))`;
    await queryRunner.query(
      `UPDATE tb_roster_assignments SET idtb_band_functions = NULL
        WHERE idtb_band_functions = ${musician}`,
    );
    await queryRunner.query(
      `DELETE FROM tb_member_functions WHERE idtb_band_functions = ${musician}`,
    );
    await queryRunner.query(
      `DELETE FROM tb_band_functions WHERE lower(name) = lower('Músico')`,
    );
  }
}
