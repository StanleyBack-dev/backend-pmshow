import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type {
  AuditEntry,
  AuditEntryInput,
  AuditFilter,
  AuditLogRepositoryPort,
} from "@/modules/audit/application/ports/audit-log-repository.port";
import { AuditLogOrmEntity } from "@/modules/audit/infrastructure/persistence/typeorm/entities/audit-log.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

type AuditRow = AuditLogOrmEntity & { actor_name: string | null };

@Injectable()
export class AuditLogTypeormRepository implements AuditLogRepositoryPort {
  constructor(
    @InjectRepository(AuditLogOrmEntity)
    private readonly repository: Repository<AuditLogOrmEntity>,
  ) {}

  async append(entry: AuditEntryInput): Promise<void> {
    await this.repository.save(
      this.repository.create({
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ip: entry.ip ?? null,
      }),
    );
  }

  async list(
    filter: AuditFilter,
    page: PageRequest,
  ): Promise<Paginated<AuditEntry>> {
    const query = this.repository
      .createQueryBuilder("log")
      // The actor's current name, read-only: tb_users belongs to identity.
      .leftJoin("tb_users", "actor", "actor.idtb_users = log.actor_id")
      .addSelect("actor.name", "actor_name")
      .orderBy("log.createdAt", "DESC")
      .skip((page.page - 1) * page.limit)
      .take(page.limit);

    if (filter.entity) query.andWhere("log.entity = :entity", filter);
    if (filter.entityId) query.andWhere("log.entity_id = :entityId", filter);
    if (filter.actorId) query.andWhere("log.actor_id = :actorId", filter);

    const [{ entities, raw }, total] = await Promise.all([
      query.getRawAndEntities(),
      query.getCount(),
    ]);

    const items = entities.map((row, index) => {
      const extra = raw[index] as Pick<AuditRow, "actor_name">;
      return {
        id: row.id,
        actorId: row.actorId,
        actorName: extra?.actor_name ?? null,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        before: row.before,
        after: row.after,
        ip: row.ip,
        createdAt: row.createdAt,
      };
    });
    return paginate(items, total, page);
  }
}
