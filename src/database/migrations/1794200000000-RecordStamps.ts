import type { MigrationInterface, QueryRunner } from "typeorm";

type Stamp = "created_at" | "updated_at" | "created_by" | "updated_by";

// Each table records who created it and who changed it last (and when), in
// its own columns, instead of an ever-growing audit log. What the log knew
// is carried over, then the log is dropped.
const TABLES: {
  entity: string;
  table: string;
  key: string;
  /** Stamp columns this migration adds (the others already exist). */
  add: Stamp[];
}[] = [
  {
    entity: "user",
    table: "tb_users",
    key: "idtb_users",
    add: ["created_by", "updated_by"],
  },
  {
    entity: "member",
    table: "tb_members",
    key: "idtb_users",
    add: ["created_by", "updated_by"],
  },
  { entity: "song", table: "tb_songs", key: "idtb_songs", add: ["updated_by"] },
  {
    entity: "artist",
    table: "tb_artists",
    key: "idtb_artists",
    add: ["updated_at", "updated_by"],
  },
  {
    entity: "event",
    table: "tb_events",
    key: "idtb_events",
    add: ["updated_by"],
  },
  {
    entity: "venue",
    table: "tb_venues",
    key: "idtb_venues",
    add: ["created_at", "updated_at", "created_by", "updated_by"],
  },
  {
    entity: "instrument",
    table: "tb_instruments",
    key: "idtb_instruments",
    add: ["created_at", "updated_at", "created_by", "updated_by"],
  },
  {
    entity: "absence",
    table: "tb_absences",
    key: "idtb_absences",
    add: ["updated_at", "updated_by"],
  },
  {
    entity: "broadcast",
    table: "tb_broadcasts",
    key: "idtb_broadcasts",
    add: ["updated_at", "updated_by"],
  },
  {
    entity: "roster",
    table: "tb_rosters",
    key: "idtb_events",
    add: ["created_by", "updated_by"],
  },
  {
    entity: "media",
    table: "tb_media_assets",
    key: "idtb_media_assets",
    add: ["updated_at", "updated_by"],
  },
];

const DEFINITION: Record<Stamp, string> = {
  created_at: "timestamptz NOT NULL DEFAULT now()",
  updated_at: "timestamptz NOT NULL DEFAULT now()",
  created_by: `uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL`,
  updated_by: `uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL`,
};

/** Log actions that mean "this record was created". */
const CREATION = `(action LIKE '%.created' OR action LIKE '%.registered' OR action LIKE '%.requested')`;

export class RecordStamps1794200000000 implements MigrationInterface {
  name = "RecordStamps1794200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { entity, table, key, add } of TABLES) {
      for (const column of add) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ADD COLUMN "${column}" ${DEFINITION[column]}`,
        );
      }
      // Creator: the log's creation entry, when the row has none yet.
      await queryRunner.query(
        `UPDATE "${table}" t
            SET created_by = l.actor_id
           FROM (
             SELECT DISTINCT ON (entity_id) entity_id, actor_id
               FROM tb_audit_logs
              WHERE entity = $1 AND ${CREATION}
              ORDER BY entity_id, created_at
           ) l
          WHERE t.created_by IS NULL
            AND t."${key}"::text = l.entity_id
            AND EXISTS (SELECT 1 FROM tb_users u WHERE u.idtb_users = l.actor_id)`,
        [entity],
      );
      // Last change: the newest entry that is not the creation.
      await queryRunner.query(
        `UPDATE "${table}" t
            SET updated_by = l.actor_id,
                updated_at = greatest(t.updated_at, l.created_at)
           FROM (
             SELECT DISTINCT ON (entity_id) entity_id, actor_id, created_at
               FROM tb_audit_logs
              WHERE entity = $1 AND NOT ${CREATION}
              ORDER BY entity_id, created_at DESC
           ) l
          WHERE t."${key}"::text = l.entity_id
            AND EXISTS (SELECT 1 FROM tb_users u WHERE u.idtb_users = l.actor_id)`,
        [entity],
      );
    }
    await queryRunner.query(`DROP TABLE "tb_audit_logs"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
    for (const { table, add } of TABLES) {
      for (const column of add) {
        await queryRunner.query(
          `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`,
        );
      }
    }
  }
}
