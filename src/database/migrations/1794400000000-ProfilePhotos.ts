import type { MigrationInterface, QueryRunner } from "typeorm";

// Profile photos (object storage keys): sent with the public sign-up and
// carried to the account when it is approved.
export class ProfilePhotos1794400000000 implements MigrationInterface {
  name = "ProfilePhotos1794400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_enrollment_requests" ADD COLUMN "photo_key" varchar(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_users" ADD COLUMN "avatar_key" varchar(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tb_users" DROP COLUMN "avatar_key"`);
    await queryRunner.query(
      `ALTER TABLE "tb_enrollment_requests" DROP COLUMN "photo_key"`,
    );
  }
}
