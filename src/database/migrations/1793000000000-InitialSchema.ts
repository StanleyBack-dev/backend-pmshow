import type { MigrationInterface, QueryRunner } from "typeorm";

// PM SHOW starts from a clean database. Each phase adds its own migration on
// top of this one.
export class InitialSchema1793000000000 implements MigrationInterface {
  name = "InitialSchema1793000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // === shared lease lock (concurrent serverless invocations) ===
    await queryRunner.query(`
      CREATE TABLE "tb_locks" (
        "name" varchar(64) PRIMARY KEY,
        "holder" varchar(64) NOT NULL,
        "lease_until" timestamptz NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_locks"`);
  }
}
