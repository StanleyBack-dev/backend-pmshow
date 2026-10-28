import type { MigrationInterface, QueryRunner } from "typeorm";

// When the person finished (or skipped) the app's guided tour. Empty for
// everyone, so existing accounts also see it once.
export class UserOnboarding1795100000000 implements MigrationInterface {
  name = "UserOnboarding1795100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_users" ADD COLUMN "onboarding_completed_at" timestamptz NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_users" DROP COLUMN IF EXISTS "onboarding_completed_at"`,
    );
  }
}
