import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { MoreThanOrEqual, type DataSource } from "typeorm";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import type {
  NewSupportRequest,
  SupportFilter,
  SupportRepositoryPort,
  SupportRequestView,
} from "@/modules/support/application/ports/support-repository.port";
import type {
  SupportCategory,
  SupportRequest,
  SupportStatus,
} from "@/modules/support/domain/support-request";
import { SupportRequestOrmEntity } from "@/modules/support/infrastructure/persistence/typeorm/support-request.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

type SupportRow = {
  id: string;
  protocol: number;
  user_id: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  reply: string | null;
  replied_at: Date | null;
  replied_by: string | null;
  finalized_at: Date | null;
  finalized_by: string | null;
  created_at: Date;
  user_name: string;
  war_name: string | null;
  replied_by_name: string | null;
  finalized_by_name: string | null;
};

const toView = (row: SupportRow): SupportRequestView => ({
  id: row.id,
  protocol: Number(row.protocol),
  userId: row.user_id,
  category: row.category,
  subject: row.subject,
  message: row.message,
  status: row.status,
  reply: row.reply,
  repliedAt: row.replied_at,
  repliedBy: row.replied_by,
  finalizedAt: row.finalized_at,
  finalizedBy: row.finalized_by,
  createdAt: row.created_at,
  userName: row.user_name,
  warName: row.war_name,
  repliedByName: row.replied_by_name,
  finalizedByName: row.finalized_by_name,
});

// Joins tb_users/tb_members (identity and members) read-only for the names
// the screens show, without a query per row.
const SELECT = `
  SELECT s.idtb_support_requests AS id, s.protocol, s.idtb_users AS user_id,
         s.category, s.subject, s.message, s.status, s.reply, s.replied_at,
         s.replied_by, s.finalized_at, s.finalized_by, s.created_at,
         u.name AS user_name, m.war_name,
         ru.name AS replied_by_name, fu.name AS finalized_by_name
    FROM tb_support_requests s
    JOIN tb_users u ON u.idtb_users = s.idtb_users
    LEFT JOIN tb_members m ON m.idtb_users = s.idtb_users
    LEFT JOIN tb_users ru ON ru.idtb_users = s.replied_by
    LEFT JOIN tb_users fu ON fu.idtb_users = s.finalized_by`;

@Injectable()
export class SupportTypeormRepository implements SupportRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async create(
    request: NewSupportRequest,
    notices: (saved: SupportRequest) => OutboxDraft[],
  ): Promise<SupportRequestView> {
    const id = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SupportRequestOrmEntity);
      const { id } = await repository.save(repository.create(request));
      // Reloaded for the protocol the database just numbered.
      const saved = await repository.findOneByOrFail({ id });
      await this.outbox.write(manager, notices({ ...saved }));
      return id;
    });
    return this.mustFind(id);
  }

  countSince(userId: string, since: Date): Promise<number> {
    return this.dataSource
      .getRepository(SupportRequestOrmEntity)
      .count({ where: { userId, createdAt: MoreThanOrEqual(since) } });
  }

  async findById(id: string): Promise<SupportRequestView | null> {
    const rows = await this.dataSource.query<SupportRow[]>(
      `${SELECT} WHERE s.idtb_support_requests = $1`,
      [id],
    );
    return rows[0] ? toView(rows[0]) : null;
  }

  async list(
    filter: SupportFilter,
    page: PageRequest,
  ): Promise<Paginated<SupportRequestView>> {
    const params: unknown[] = [];
    const where: string[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (filter.userId) where.push(`s.idtb_users = ${param(filter.userId)}`);
    if (filter.status) where.push(`s.status = ${param(filter.status)}`);
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows, [{ total }]] = await Promise.all([
      this.dataSource.query<SupportRow[]>(
        `${SELECT} ${clause}
          ORDER BY s.created_at DESC
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_support_requests s ${clause}`,
        params,
      ),
    ]);
    return paginate(rows.map(toView), total, page);
  }

  async update(
    id: string,
    change: Parameters<SupportRepositoryPort["update"]>[1],
    notices: readonly OutboxDraft[],
  ): Promise<SupportRequestView> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(SupportRequestOrmEntity)
        .update({ id }, change);
      await this.outbox.write(manager, notices);
    });
    return this.mustFind(id);
  }

  private async mustFind(id: string): Promise<SupportRequestView> {
    const found = await this.findById(id);
    if (!found) throw new Error(`Support request ${id} vanished`);
    return found;
  }
}
