import type { MigrationInterface, QueryRunner } from "typeorm";

// Functions (conductor, driver, sound technician…) get a catalog of their
// own; the instruments catalog keeps only what is played.
//
// - The instruments of the Apoio and Técnica sections become functions: the
//   members who had them get the function, roster lines keep it as their
//   function, pending sign-ups drop them, and the instruments go away.
// - Roster lines trade the fixed role (MUSICO, REGENTE…) for a function
//   (none = musician).
// - The Apoio section goes away; its members move to Técnica.

const SEED = [
  "Regente / maestro",
  "Chefe da equipe",
  "Motorista",
  "Técnico de som",
  "Técnico de luz",
  "Apoio de palco",
];

/** Old roster roles and the function each one becomes. */
const ROLE_FUNCTION: [string, string][] = [
  ["REGENTE", "Regente / maestro"],
  ["CHEFE_EQUIPE", "Chefe da equipe"],
  ["MOTORISTA", "Motorista"],
  ["SOM", "Técnico de som"],
  ["APOIO", "Apoio de palco"],
];

const NON_INSTRUMENTS = `SELECT idtb_instruments FROM tb_instruments
  WHERE section IN ('APOIO', 'TECNICA')`;

export class CreateBandFunctions1794500000000 implements MigrationInterface {
  name = "CreateBandFunctions1794500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_band_functions" (
        "idtb_band_functions" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(60) NOT NULL,
        "archived" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_band_functions_name" ON "tb_band_functions" (lower("name"))`,
    );
    await queryRunner.query(`
      CREATE TABLE "tb_member_functions" (
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_members" ("idtb_users") ON DELETE CASCADE,
        "idtb_band_functions" uuid NOT NULL
          REFERENCES "tb_band_functions" ("idtb_band_functions"),
        PRIMARY KEY ("idtb_users", "idtb_band_functions")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_member_functions_function" ON "tb_member_functions" ("idtb_band_functions")`,
    );

    // The catalog: the usual functions plus every non-instrument in use.
    for (const name of SEED) {
      await queryRunner.query(
        `INSERT INTO "tb_band_functions" ("name") VALUES ($1)
         ON CONFLICT ((lower("name"))) DO NOTHING`,
        [name],
      );
    }
    await queryRunner.query(`
      INSERT INTO "tb_band_functions" ("name", "archived")
      SELECT i.name, i.archived FROM tb_instruments i
       WHERE i.idtb_instruments IN (${NON_INSTRUMENTS})
      ON CONFLICT ((lower("name"))) DO NOTHING
    `);

    // Members keep what they did, now as a function.
    await queryRunner.query(`
      INSERT INTO "tb_member_functions" ("idtb_users", "idtb_band_functions")
      SELECT DISTINCT mi.idtb_users, f.idtb_band_functions
        FROM tb_member_instruments mi
        JOIN tb_instruments i ON i.idtb_instruments = mi.idtb_instruments
        JOIN tb_band_functions f ON lower(f.name) = lower(i.name)
       WHERE i.idtb_instruments IN (${NON_INSTRUMENTS})
      ON CONFLICT DO NOTHING
    `);

    // Roster lines: the role becomes a function.
    await queryRunner.query(`
      ALTER TABLE "tb_roster_assignments"
        ADD COLUMN "idtb_band_functions" uuid
          REFERENCES "tb_band_functions" ("idtb_band_functions")
    `);
    for (const [role, name] of ROLE_FUNCTION) {
      await queryRunner.query(
        `UPDATE tb_roster_assignments a
            SET idtb_band_functions = f.idtb_band_functions
           FROM tb_band_functions f
          WHERE a.role = $1 AND lower(f.name) = lower($2)`,
        [role, name],
      );
    }
    // A line "playing" a non-instrument: that is its function.
    await queryRunner.query(`
      UPDATE tb_roster_assignments a
         SET idtb_band_functions = coalesce(a.idtb_band_functions, f.idtb_band_functions),
             idtb_instruments = NULL
        FROM tb_instruments i
        JOIN tb_band_functions f ON lower(f.name) = lower(i.name)
       WHERE a.idtb_instruments = i.idtb_instruments
         AND i.idtb_instruments IN (${NON_INSTRUMENTS})
    `);
    await queryRunner.query(
      `ALTER TABLE "tb_roster_assignments" DROP COLUMN "role"`,
    );

    // Sign-ups not yet reviewed drop the non-instruments they picked.
    await queryRunner.query(`
      UPDATE tb_enrollment_requests r
         SET instruments = coalesce((
               SELECT jsonb_agg(choice)
                 FROM jsonb_array_elements(r.instruments) choice
                WHERE (choice ->> 'instrumentId')::uuid NOT IN (${NON_INSTRUMENTS})
             ), '[]'::jsonb)
    `);

    await queryRunner.query(`
      DELETE FROM tb_member_instruments
       WHERE idtb_instruments IN (${NON_INSTRUMENTS})
    `);
    await queryRunner.query(`
      DELETE FROM tb_instruments WHERE section IN ('APOIO', 'TECNICA')
    `);
    await queryRunner.query(
      `UPDATE tb_members SET section = 'TECNICA' WHERE section = 'APOIO'`,
    );
  }

  // Best effort: roles come back from the functions; the removed
  // instruments and the Apoio section are not recreated.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_roster_assignments"
        ADD COLUMN "role" varchar(16) NOT NULL DEFAULT 'MUSICO'
    `);
    for (const [role, name] of ROLE_FUNCTION) {
      await queryRunner.query(
        `UPDATE tb_roster_assignments a
            SET role = $1
           FROM tb_band_functions f
          WHERE a.idtb_band_functions = f.idtb_band_functions
            AND lower(f.name) = lower($2)`,
        [role, name],
      );
    }
    await queryRunner.query(
      `ALTER TABLE "tb_roster_assignments" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_roster_assignments" DROP COLUMN "idtb_band_functions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_member_functions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_band_functions"`);
  }
}
