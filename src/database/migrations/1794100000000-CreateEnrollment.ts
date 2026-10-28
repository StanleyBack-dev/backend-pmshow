import type { MigrationInterface, QueryRunner } from "typeorm";

// Self-service sign-up: a manager shares a code (one per cohort), musicians
// fill in a public form and each answer waits for a manager's approval,
// which creates the account and the band profile.
export class CreateEnrollment1794100000000 implements MigrationInterface {
  name = "CreateEnrollment1794100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_enrollment_invites" (
        "idtb_enrollment_invites" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(6) NOT NULL CHECK ("code" ~ '^[0-9]{6}$'),
        "label" varchar(80) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_by" uuid NOT NULL REFERENCES "tb_users" ("idtb_users"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_enrollment_invites_code" ON "tb_enrollment_invites" ("code") WHERE "revoked_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_enrollment_requests" (
        "idtb_enrollment_requests" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_enrollment_invites" uuid
          REFERENCES "tb_enrollment_invites" ("idtb_enrollment_invites")
          ON DELETE SET NULL,
        "status" varchar(10) NOT NULL DEFAULT 'PENDENTE'
          CHECK ("status" IN ('PENDENTE', 'APROVADA', 'RECUSADA')),
        "full_name" varchar(160) NOT NULL,
        "email" varchar(254) NOT NULL,
        "phone" varchar(11) NOT NULL,
        "military" boolean NOT NULL,
        "military_id" varchar(5) CHECK ("military_id" ~ '^[0-9]{5}$'),
        "rank" varchar(24) NOT NULL,
        "war_name" varchar(60) NOT NULL,
        "instruments" jsonb NOT NULL,
        "consent_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "reviewed_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "rejection_reason" varchar(500),
        "idtb_users" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CHECK ("military" = ("military_id" IS NOT NULL))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_enrollment_requests_status" ON "tb_enrollment_requests" ("status", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_enrollment_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_enrollment_invites"`);
  }
}
