import type { MigrationInterface, QueryRunner } from "typeorm";

// Support requests (Suporte): anyone signed in asks, the administrators
// answer and close them. The protocol is a plain sequence people can quote.
export class CreateSupportRequests1795000000000 implements MigrationInterface {
  name = "CreateSupportRequests1795000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_support_requests" (
        "idtb_support_requests" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "protocol" integer GENERATED ALWAYS AS IDENTITY UNIQUE,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "category" varchar(16) NOT NULL
          CHECK ("category" IN ('DUVIDA', 'PROBLEMA', 'ACESSO', 'SUGESTAO', 'OUTRO')),
        "subject" varchar(120) NOT NULL,
        "message" varchar(2000) NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'ABERTO'
          CHECK ("status" IN ('ABERTO', 'RESPONDIDO', 'FINALIZADO')),
        "reply" varchar(2000),
        "replied_at" timestamptz,
        "replied_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "finalized_at" timestamptz,
        "finalized_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    // The daily limit counts a person's requests of the day.
    await queryRunner.query(
      `CREATE INDEX "ix_support_requests_user_created" ON "tb_support_requests" ("idtb_users", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_support_requests_status_created" ON "tb_support_requests" ("status", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_support_requests"`);
  }
}
