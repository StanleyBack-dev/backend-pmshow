import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import type { SystemLog } from "@/modules/system-logs/domain/system-log";
import type {
  SystemLogFilter,
  SystemLogRepositoryPort,
  SystemLogSummary,
  SystemLogView,
} from "@/modules/system-logs/application/ports/system-log-repository.port";
import { SystemLogOrmEntity } from "@/modules/system-logs/infrastructure/system-log.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

@Injectable()
export class SystemLogRepository implements SystemLogRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async insert(log: Omit<SystemLog, "id" | "createdAt">): Promise<void> {
    await this.dataSource.getRepository(SystemLogOrmEntity).insert({
      ...log,
      details: log.details as QueryDeepPartialEntity<
        SystemLogOrmEntity["details"]
      >,
    });
  }

  async page(
    filter: SystemLogFilter,
    page: PageRequest,
  ): Promise<Paginated<SystemLogView>> {
    const params: unknown[] = [];
    const where: string[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (filter.from) where.push(`l.created_at >= ${param(filter.from)}`);
    if (filter.to) where.push(`l.created_at < ${param(filter.to)}`);
    if (filter.levels?.length) {
      where.push(`l.level = ANY(${param(filter.levels)}::varchar[])`);
    }
    if (filter.categories?.length) {
      where.push(`l.category = ANY(${param(filter.categories)}::varchar[])`);
    }
    if (filter.environment) {
      where.push(`l.environment = ${param(filter.environment)}`);
    }
    if (filter.search?.trim()) {
      const term = param(`%${filter.search.trim()}%`);
      where.push(`(l.message ILIKE ${term} OR l.source ILIKE ${term})`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows, [{ total }]] = await Promise.all([
      this.dataSource.query<
        (Omit<SystemLogView, "statusCode" | "durationMs"> & {
          statusCode: number | null;
          durationMs: number | null;
        })[]
      >(
        `SELECT l.idtb_system_logs AS id, l.level, l.category, l.source,
                l.message, l.details, l.idtb_users AS "userId", l.ip,
                l.status_code AS "statusCode", l.duration_ms AS "durationMs",
                l.environment, l.created_at AS "createdAt",
                u.name AS "userName"
           FROM tb_system_logs l
           LEFT JOIN tb_users u ON u.idtb_users = l.idtb_users
           ${clause}
          ORDER BY l.created_at DESC
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_system_logs l ${clause}`,
        params,
      ),
    ]);
    return paginate(rows, total, page);
  }

  async summary(now: Date): Promise<SystemLogSummary[]> {
    return this.dataSource.query<SystemLogSummary[]>(
      `SELECT level,
              count(*) FILTER (WHERE created_at >= $1)::int AS "last24h",
              count(*)::int AS "last7d"
         FROM tb_system_logs
        WHERE created_at >= $2
        GROUP BY level`,
      [
        new Date(now.getTime() - 86_400_000),
        new Date(now.getTime() - 7 * 86_400_000),
      ],
    );
  }

  async purgeBefore(before: Date): Promise<number> {
    const result = await this.dataSource
      .getRepository(SystemLogOrmEntity)
      .createQueryBuilder()
      .delete()
      .where("created_at < :before", { before })
      .execute();
    return result.affected ?? 0;
  }
}
