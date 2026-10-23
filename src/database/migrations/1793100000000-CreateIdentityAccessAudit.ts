import type { MigrationInterface, QueryRunner } from "typeorm";

// Phase 1: users, credentials, sessions, password recovery codes, per-user
// permission overrides and the audit trail.
export class CreateIdentityAccessAudit1793100000000 implements MigrationInterface {
  name = "CreateIdentityAccessAudit1793100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_users" (
        "idtb_users" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "email" varchar(254) NOT NULL,
        "username" varchar(32) NOT NULL,
        "group" varchar(16) NOT NULL
          CHECK ("group" IN ('USER', 'ADMIN', 'ADMIN_MASTER')),
        "active" boolean NOT NULL DEFAULT true,
        "deactivated_at" timestamptz,
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_username" ON "tb_users" ("username")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email_lower" ON "tb_users" (lower("email"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_auth_credentials" (
        "idtb_users" uuid PRIMARY KEY
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "password_hash" varchar(255) NOT NULL,
        "must_change_password" boolean NOT NULL DEFAULT true,
        "failed_login_attempts" int NOT NULL DEFAULT 0,
        "locked_until" timestamptz,
        "password_changed_at" timestamptz,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tb_sessions" (
        "idtb_sessions" uuid PRIMARY KEY,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "refresh_secret_hash" varchar(128) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "last_used_at" timestamptz NOT NULL,
        "ip_address" varchar(64),
        "user_agent" varchar(512),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_user" ON "tb_sessions" ("idtb_users")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_auth_verification_codes" (
        "idtb_auth_verification_codes" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "purpose" varchar(32) NOT NULL,
        "code_hash" varchar(128) NOT NULL,
        "attempts" int NOT NULL DEFAULT 0,
        "max_attempts" int NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "verified_at" timestamptz,
        "reset_token_hash" varchar(128),
        "reset_token_expires_at" timestamptz,
        "consumed_at" timestamptz,
        "invalidated_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_verification_codes_user_purpose" ON "tb_auth_verification_codes" ("idtb_users", "purpose", "created_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_verification_codes_reset_token" ON "tb_auth_verification_codes" ("reset_token_hash") WHERE "reset_token_hash" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_user_permission_overrides" (
        "idtb_user_permission_overrides" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "permission" varchar(64) NOT NULL,
        "allowed" boolean NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_permission_overrides_user_permission"
          UNIQUE ("idtb_users", "permission")
      )
    `);

    // No FK on actor_id: the trail outlives the people in it.
    await queryRunner.query(`
      CREATE TABLE "tb_audit_logs" (
        "idtb_audit_logs" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_id" uuid,
        "action" varchar(64) NOT NULL,
        "entity" varchar(64) NOT NULL,
        "entity_id" varchar(64),
        "before" jsonb,
        "after" jsonb,
        "ip" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_audit_logs_entity" ON "tb_audit_logs" ("entity", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_audit_logs_created_at" ON "tb_audit_logs" ("created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_audit_logs"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tb_user_permission_overrides"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tb_auth_verification_codes"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_auth_credentials"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_users"`);
  }
}
