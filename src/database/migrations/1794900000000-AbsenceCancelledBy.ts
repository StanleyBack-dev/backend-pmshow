import type { MigrationInterface, QueryRunner } from "typeorm";

// Who cancelled an absence and when (shown with the request, like the review).
export class AbsenceCancelledBy1794900000000 implements MigrationInterface {
  name = "AbsenceCancelledBy1794900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_absences"
        ADD COLUMN "cancelled_by" uuid NULL,
        ADD COLUMN "cancelled_at" timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_absences"
        DROP COLUMN IF EXISTS "cancelled_at",
        DROP COLUMN IF EXISTS "cancelled_by"
    `);
  }
}
