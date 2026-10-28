import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { RecordStampRepositoryPort } from "@/modules/audit/application/ports/record-stamp-repository.port";
import {
  STAMPED_TABLES,
  type RecordStamp,
  type StampedEntity,
  type StampInput,
} from "@/modules/audit/domain/record-stamp";

// Table and key names come only from STAMPED_TABLES (never from input), so
// they are safe to place in the SQL; values always go as parameters.
@Injectable()
export class RecordStampTypeormRepository implements RecordStampRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async stamp(input: StampInput): Promise<void> {
    const { table, key } = STAMPED_TABLES[input.entity];
    const creator = input.created
      ? `, created_by = COALESCE(created_by, $1)`
      : "";
    await this.dataSource.query(
      `UPDATE "${table}"
          SET updated_by = $1, updated_at = now()${creator}
        WHERE "${key}"::text = $2`,
      [input.actorId, input.entityId],
    );
  }

  async stampMany(
    input: Omit<StampInput, "entityId"> & { entityIds: readonly string[] },
  ): Promise<void> {
    if (input.entityIds.length === 0) return;
    const { table, key } = STAMPED_TABLES[input.entity];
    const creator = input.created
      ? `, created_by = COALESCE(created_by, $1)`
      : "";
    await this.dataSource.query(
      `UPDATE "${table}"
          SET updated_by = $1, updated_at = now()${creator}
        WHERE "${key}"::text = ANY($2::text[])`,
      [input.actorId, [...input.entityIds]],
    );
  }

  async find(entity: StampedEntity, id: string): Promise<RecordStamp | null> {
    const { table, key } = STAMPED_TABLES[entity];
    const rows: {
      created_at: Date;
      created_by: string | null;
      created_by_name: string | null;
      updated_at: Date;
      updated_by: string | null;
      updated_by_name: string | null;
    }[] = await this.dataSource.query(
      `SELECT t.created_at, t.created_by, c.name AS created_by_name,
              t.updated_at, t.updated_by, u.name AS updated_by_name
         FROM "${table}" t
         LEFT JOIN tb_users c ON c.idtb_users = t.created_by
         LEFT JOIN tb_users u ON u.idtb_users = t.updated_by
        WHERE t."${key}"::text = $1`,
      [id],
    );
    const row = rows[0];
    return row
      ? {
          createdAt: row.created_at,
          createdById: row.created_by,
          createdByName: row.created_by_name,
          updatedAt: row.updated_at,
          updatedById: row.updated_by,
          updatedByName: row.updated_by_name,
        }
      : null;
  }
}
