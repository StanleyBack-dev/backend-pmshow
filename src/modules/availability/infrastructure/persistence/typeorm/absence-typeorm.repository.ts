import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  AbsenceFilter,
  AbsenceRepositoryPort,
  AbsenceView,
  NewAbsence,
} from "@/modules/availability/application/ports/absence-repository.port";
import type {
  AbsenceStatus,
  AbsenceType,
} from "@/modules/availability/domain/absence";
import { AbsenceOrmEntity } from "@/modules/availability/infrastructure/persistence/typeorm/absence.orm-entity";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";

type AbsenceRow = {
  id: string;
  user_id: string;
  type: AbsenceType;
  starts_on: string;
  ends_on: string;
  reason: string | null;
  status: AbsenceStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_by: string;
  created_at: Date;
  user_name: string;
  war_name: string | null;
};

const toView = (row: AbsenceRow): AbsenceView => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  reason: row.reason,
  status: row.status,
  reviewNote: row.review_note,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  userName: row.user_name,
  warName: row.war_name,
});

// Joins tb_users/tb_members (owned by identity and members) read-only, to
// show whose absence it is without a query per row.
const SELECT = `
  SELECT a.idtb_absences AS id, a.idtb_users AS user_id, a.type,
         to_char(a.starts_on, 'YYYY-MM-DD') AS starts_on,
         to_char(a.ends_on, 'YYYY-MM-DD') AS ends_on,
         a.reason, a.status, a.review_note, a.reviewed_by, a.reviewed_at,
         a.created_by, a.created_at, u.name AS user_name, m.war_name
    FROM tb_absences a
    JOIN tb_users u ON u.idtb_users = a.idtb_users
    LEFT JOIN tb_members m ON m.idtb_users = a.idtb_users`;

@Injectable()
export class AbsenceTypeormRepository implements AbsenceRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async list(filter: AbsenceFilter, limit: number): Promise<AbsenceView[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (filter.userIds) {
      where.push(`a.idtb_users = ANY(${param(filter.userIds)}::uuid[])`);
    }
    if (filter.statuses?.length) {
      where.push(`a.status = ANY(${param(filter.statuses)}::varchar[])`);
    }
    if (filter.period) {
      where.push(
        `a.starts_on <= ${param(filter.period.endsOn)}::date AND a.ends_on >= ${param(filter.period.startsOn)}::date`,
      );
    }
    const rows = await this.dataSource.query<AbsenceRow[]>(
      `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY a.starts_on DESC, a.created_at DESC
        LIMIT ${param(limit)}`,
      params,
    );
    return rows.map(toView);
  }

  async findById(id: string): Promise<AbsenceView | null> {
    const rows = await this.dataSource.query<AbsenceRow[]>(
      `${SELECT} WHERE a.idtb_absences = $1`,
      [id],
    );
    return rows[0] ? toView(rows[0]) : null;
  }

  async create(absence: NewAbsence): Promise<AbsenceView> {
    const saved = await this.dataSource
      .getRepository(AbsenceOrmEntity)
      .save(absence);
    return this.mustFind(saved.id);
  }

  async setStatus(
    id: string,
    change: {
      status: AbsenceStatus;
      reviewedBy?: string;
      reviewedAt?: Date;
      reviewNote?: string | null;
    },
    notifications: readonly OutboxDraft[],
  ): Promise<AbsenceView> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(AbsenceOrmEntity).update({ id }, change);
      await this.outbox.write(manager, notifications);
    });
    return this.mustFind(id);
  }

  private async mustFind(id: string): Promise<AbsenceView> {
    const found = await this.findById(id);
    if (!found) throw new Error(`Absence ${id} vanished`);
    return found;
  }
}
