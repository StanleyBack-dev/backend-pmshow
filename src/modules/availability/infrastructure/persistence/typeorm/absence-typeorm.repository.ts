import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { In, type DataSource } from "typeorm";
import type {
  AbsenceFilter,
  AbsenceRepositoryPort,
  AbsenceView,
  NewAbsence,
  NewAttachment,
} from "@/modules/availability/application/ports/absence-repository.port";
import type { AbsenceAttachment } from "@/modules/availability/domain/absence-attachment";
import type {
  AbsenceStatus,
  AbsenceType,
} from "@/modules/availability/domain/absence";
import {
  AbsenceAttachmentOrmEntity,
  AbsenceOrmEntity,
} from "@/modules/availability/infrastructure/persistence/typeorm/absence.orm-entity";
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
  cancelled_by: string | null;
  cancelled_at: Date | null;
  created_by: string;
  created_at: Date;
  user_name: string;
  war_name: string | null;
  reviewer_name: string | null;
  reviewer_war_name: string | null;
  canceller_name: string | null;
  canceller_war_name: string | null;
};

/** "Full name (war name)", or just the name without a band profile. */
const signature = (name: string | null, warName: string | null) =>
  name && warName ? `${name} (${warName})` : name;

const toAttachment = (row: AbsenceAttachmentOrmEntity): AbsenceAttachment => ({
  id: row.id,
  absenceId: row.absenceId,
  storageKey: row.storageKey,
  fileName: row.fileName,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
});

const toView = (
  row: AbsenceRow,
  attachments: AbsenceAttachment[] = [],
): AbsenceView => ({
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
  cancelledBy: row.cancelled_by,
  cancelledAt: row.cancelled_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  userName: row.user_name,
  warName: row.war_name,
  reviewedByName: signature(row.reviewer_name, row.reviewer_war_name),
  cancelledByName: signature(row.canceller_name, row.canceller_war_name),
  registered: row.created_by !== row.user_id,
  attachments,
});

// Joins tb_users/tb_members (owned by identity and members) read-only, to
// show whose absence it is (and who reviewed / cancelled it) without a
// query per row.
const SELECT = `
  SELECT a.idtb_absences AS id, a.idtb_users AS user_id, a.type,
         to_char(a.starts_on, 'YYYY-MM-DD') AS starts_on,
         to_char(a.ends_on, 'YYYY-MM-DD') AS ends_on,
         a.reason, a.status, a.review_note, a.reviewed_by, a.reviewed_at,
         a.cancelled_by, a.cancelled_at,
         a.created_by, a.created_at, u.name AS user_name, m.war_name,
         ru.name AS reviewer_name, rm.war_name AS reviewer_war_name,
         cu.name AS canceller_name, cm.war_name AS canceller_war_name
    FROM tb_absences a
    JOIN tb_users u ON u.idtb_users = a.idtb_users
    LEFT JOIN tb_members m ON m.idtb_users = a.idtb_users
    LEFT JOIN tb_users ru ON ru.idtb_users = a.reviewed_by
    LEFT JOIN tb_members rm ON rm.idtb_users = a.reviewed_by
    LEFT JOIN tb_users cu ON cu.idtb_users = a.cancelled_by
    LEFT JOIN tb_members cm ON cm.idtb_users = a.cancelled_by`;

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
    return this.withAttachments(rows);
  }

  async findById(id: string): Promise<AbsenceView | null> {
    const rows = await this.dataSource.query<AbsenceRow[]>(
      `${SELECT} WHERE a.idtb_absences = $1`,
      [id],
    );
    return (await this.withAttachments(rows))[0] ?? null;
  }

  async findAttachment(
    id: string,
  ): Promise<(AbsenceAttachment & { userId: string }) | null> {
    const row = await this.dataSource
      .getRepository(AbsenceAttachmentOrmEntity)
      .findOne({ where: { id } });
    if (!row) return null;
    const absence = await this.dataSource
      .getRepository(AbsenceOrmEntity)
      .findOne({ where: { id: row.absenceId }, select: { userId: true } });
    return absence ? { ...toAttachment(row), userId: absence.userId } : null;
  }

  /** The files of these absences, one query for all. */
  private async withAttachments(rows: AbsenceRow[]): Promise<AbsenceView[]> {
    if (rows.length === 0) return [];
    const files = await this.dataSource
      .getRepository(AbsenceAttachmentOrmEntity)
      .find({
        where: { absenceId: In(rows.map((row) => row.id)) },
        order: { createdAt: "ASC" },
      });
    return rows.map((row) =>
      toView(
        row,
        files.filter((file) => file.absenceId === row.id).map(toAttachment),
      ),
    );
  }

  async create(
    absence: NewAbsence,
    notifications: readonly OutboxDraft[] = [],
    attachments: readonly NewAttachment[] = [],
  ): Promise<AbsenceView> {
    const id = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(AbsenceOrmEntity).save(absence);
      if (attachments.length > 0) {
        await manager
          .getRepository(AbsenceAttachmentOrmEntity)
          .insert(
            attachments.map((file) => ({ ...file, absenceId: saved.id })),
          );
      }
      await this.outbox.write(manager, notifications);
      return saved.id;
    });
    return this.mustFind(id);
  }

  async setStatus(
    id: string,
    change: {
      status: AbsenceStatus;
      reviewedBy?: string;
      reviewedAt?: Date;
      reviewNote?: string | null;
      cancelledBy?: string;
      cancelledAt?: Date;
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
