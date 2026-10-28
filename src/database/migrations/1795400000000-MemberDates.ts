import type { MigrationInterface, QueryRunner } from "typeorm";

// Birthday and band start date of every user (empty for the existing ones
// until filled in in "Meu perfil"); the public sign-up asks only the
// birthday (required).
export class MemberDates1795400000000 implements MigrationInterface {
  name = "MemberDates1795400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_users"
        ADD COLUMN "birth_date" date NULL,
        ADD COLUMN "joined_on" date NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_requests"
        ADD COLUMN "birth_date" date NULL
    `);
    // The month's birthdays.
    await queryRunner.query(
      `CREATE INDEX "ix_users_birth_month" ON "tb_users" ((extract(month FROM "birth_date")))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_users_birth_month"`);
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_requests"
        DROP COLUMN IF EXISTS "birth_date"
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_users"
        DROP COLUMN IF EXISTS "joined_on",
        DROP COLUMN IF EXISTS "birth_date"
    `);
  }
}
