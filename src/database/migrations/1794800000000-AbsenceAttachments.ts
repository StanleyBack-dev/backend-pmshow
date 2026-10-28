import type { MigrationInterface, QueryRunner } from "typeorm";

// Files attached to an absence request (images or PDFs, at most 3), kept in
// object storage; the row keeps the key, the name and the size.
export class AbsenceAttachments1794800000000 implements MigrationInterface {
  name = "AbsenceAttachments1794800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_absence_attachments" (
        "idtb_absence_attachments" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_absences" uuid NOT NULL
          REFERENCES "tb_absences" ("idtb_absences") ON DELETE CASCADE,
        "storage_key" varchar(300) NOT NULL UNIQUE,
        "file_name" varchar(160) NOT NULL,
        "mime_type" varchar(60) NOT NULL,
        "size_bytes" integer NOT NULL CHECK ("size_bytes" > 0),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_absence_attachments_absence" ON "tb_absence_attachments" ("idtb_absences")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_absence_attachments"`);
  }
}
