import type { MigrationInterface, QueryRunner } from "typeorm";

// More instruments of a military band and of its popular-music shows
// (keyboards, accordion…). Names are unique ignoring case, so one already
// created by hand is kept as it is.
const INSTRUMENTS: [string, string][] = [
  ["Piano", "CORDAS_BASE"],
  ["Sanfona", "CORDAS_BASE"],
  ["Órgão", "CORDAS_BASE"],
  ["Sintetizador", "CORDAS_BASE"],
  ["Baixo elétrico", "CORDAS_BASE"],
  ["Cavaquinho", "CORDAS_BASE"],
  ["Viola caipira", "CORDAS_BASE"],
  ["Violino", "CORDAS_BASE"],
  ["Violoncelo", "CORDAS_BASE"],
  ["Flautim", "MADEIRAS"],
  ["Oboé", "MADEIRAS"],
  ["Fagote", "MADEIRAS"],
  ["Clarone", "MADEIRAS"],
  ["Saxofone soprano", "MADEIRAS"],
  ["Flugelhorn", "METAIS"],
  ["Sousafone", "METAIS"],
  ["Caixa", "PERCUSSAO"],
  ["Bumbo", "PERCUSSAO"],
  ["Pratos", "PERCUSSAO"],
  ["Tímpanos", "PERCUSSAO"],
  ["Lira (glockenspiel)", "PERCUSSAO"],
  ["Backing vocal", "VOCAL"],
  ["Regente / maestro", "APOIO"],
];

export class MoreInstruments1794300000000 implements MigrationInterface {
  name = "MoreInstruments1794300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, section] of INSTRUMENTS) {
      await queryRunner.query(
        `INSERT INTO "tb_instruments" ("name", "section") VALUES ($1, $2)
         ON CONFLICT ((lower("name"))) DO NOTHING`,
        [name, section],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only those still unused by anyone.
    await queryRunner.query(
      `DELETE FROM "tb_instruments" i
        WHERE i."name" = ANY($1)
          AND NOT EXISTS (SELECT 1 FROM "tb_member_instruments" m
                           WHERE m."idtb_instruments" = i."idtb_instruments")`,
      [INSTRUMENTS.map(([name]) => name)],
    );
  }
}
