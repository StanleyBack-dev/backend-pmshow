import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  BroadcastRepositoryPort,
  BroadcastView,
} from "@/modules/broadcasts/application/ports/broadcast-repository.port";
import type { Broadcast } from "@/modules/broadcasts/domain/broadcast";
import { BroadcastOrmEntity } from "@/modules/broadcasts/infrastructure/persistence/typeorm/broadcast.orm-entity";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";

type BroadcastRow = BroadcastOrmEntity & { authorName: string | null };

const toView = (row: BroadcastRow): BroadcastView => ({
  id: row.id,
  title: row.title,
  body: row.body,
  audience: row.audience,
  section: row.section,
  eventId: row.eventId,
  sendEmail: row.sendEmail,
  recipients: row.recipients,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
  authorName: row.authorName,
});

@Injectable()
export class BroadcastTypeormRepository implements BroadcastRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async create(
    broadcast: Omit<Broadcast, "id" | "createdAt">,
    deliveries: (broadcastId: string) => OutboxDraft[],
  ): Promise<BroadcastView> {
    const id = await this.dataSource.transaction(async (manager) => {
      const saved = await manager
        .getRepository(BroadcastOrmEntity)
        .save(broadcast);
      await this.outbox.write(manager, deliveries(saved.id));
      return saved.id;
    });
    const [found] = await this.query("WHERE b.idtb_broadcasts = $1", [id], 1);
    return found;
  }

  list(limit: number): Promise<BroadcastView[]> {
    return this.query("", [], limit);
  }

  // The author's name comes from tb_users (identity), read-only.
  private async query(
    where: string,
    params: unknown[],
    limit: number,
  ): Promise<BroadcastView[]> {
    const rows = await this.dataSource.query<BroadcastRow[]>(
      `SELECT b.idtb_broadcasts AS id, b.title, b.body, b.audience, b.section,
              b.idtb_events AS "eventId", b.send_email AS "sendEmail",
              b.recipients, b.created_by AS "createdBy",
              b.created_at AS "createdAt", u.name AS "authorName"
         FROM tb_broadcasts b
         LEFT JOIN tb_users u ON u.idtb_users = b.created_by
         ${where}
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)}`,
      params,
    );
    return rows.map(toView);
  }
}
