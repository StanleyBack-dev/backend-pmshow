import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { In, type DataSource } from "typeorm";
import type {
  DutyScheduleFilter,
  DutyScheduleRepositoryPort,
  NewDutySchedule,
} from "@/modules/duty-schedules/application/ports/duty-schedule-repository.port";
import {
  DutyScheduleStatus,
  type DutySchedule,
} from "@/modules/duty-schedules/domain/duty-schedule";
import {
  DutyScheduleEventOrmEntity,
  DutyScheduleMemberOrmEntity,
  DutyScheduleOrmEntity,
} from "@/modules/duty-schedules/infrastructure/persistence/typeorm/duty-schedule.orm-entity";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

@Injectable()
export class DutyScheduleTypeormRepository implements DutyScheduleRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async create(
    data: NewDutySchedule,
    createdBy: string,
    notifications: readonly OutboxDraft[],
  ): Promise<DutySchedule> {
    const id = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(DutyScheduleOrmEntity).save({
        title: data.title,
        startsOn: data.startsOn,
        endsOn: data.endsOn,
        venueId: data.venueId,
        uniform: data.uniform,
        notes: data.notes,
        audienceKind: data.audienceKind,
        sections: data.sections,
        status: DutyScheduleStatus.ATIVA,
        cancellationReason: null,
        createdBy,
      });
      if (data.eventIds.length > 0) {
        await manager
          .getRepository(DutyScheduleEventOrmEntity)
          .insert(
            data.eventIds.map((eventId) => ({ scheduleId: saved.id, eventId })),
          );
      }
      if (data.userIds.length > 0) {
        await manager
          .getRepository(DutyScheduleMemberOrmEntity)
          .insert(
            data.userIds.map((userId) => ({ scheduleId: saved.id, userId })),
          );
      }
      await this.outbox.write(manager, notifications);
      return saved.id;
    });
    return this.mustFind(id);
  }

  async page(
    filter: DutyScheduleFilter,
    page: PageRequest,
  ): Promise<Paginated<DutySchedule>> {
    const query = this.dataSource
      .getRepository(DutyScheduleOrmEntity)
      .createQueryBuilder("s")
      .orderBy("s.starts_on", "DESC")
      .addOrderBy("s.created_at", "DESC")
      .skip((page.page - 1) * page.limit)
      .take(page.limit);
    const search = filter.search?.trim();
    if (search) {
      query.andWhere("unaccent(s.title) ILIKE unaccent(:term)", {
        term: `%${escapeLike(search)}%`,
      });
    }
    if (filter.status) {
      query.andWhere("s.status = :status", { status: filter.status });
    }
    const [rows, total] = await query.getManyAndCount();
    return paginate(await this.withLinks(rows), total, page);
  }

  async findById(id: string): Promise<DutySchedule | null> {
    const row = await this.dataSource
      .getRepository(DutyScheduleOrmEntity)
      .findOne({ where: { id } });
    return row ? ((await this.withLinks([row]))[0] ?? null) : null;
  }

  async cancel(
    id: string,
    reason: string,
    notifications: readonly OutboxDraft[],
  ): Promise<DutySchedule> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(DutyScheduleOrmEntity)
        .update(
          { id },
          { status: DutyScheduleStatus.CANCELADA, cancellationReason: reason },
        );
      await this.outbox.write(manager, notifications);
    });
    return this.mustFind(id);
  }

  private async mustFind(id: string): Promise<DutySchedule> {
    const found = await this.findById(id);
    if (!found) throw new Error(`Duty schedule ${id} vanished`);
    return found;
  }

  /** Days (events, by start) and people of each batch. */
  private async withLinks(
    rows: DutyScheduleOrmEntity[],
  ): Promise<DutySchedule[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [events, members] = await Promise.all([
      this.dataSource.query<{ schedule_id: string; event_id: string }[]>(
        `SELECT se.idtb_duty_schedules AS schedule_id,
                se.idtb_events AS event_id
           FROM tb_duty_schedule_events se
           JOIN tb_events e ON e.idtb_events = se.idtb_events
          WHERE se.idtb_duty_schedules = ANY($1::uuid[])
          ORDER BY e.starts_at`,
        [ids],
      ),
      this.dataSource
        .getRepository(DutyScheduleMemberOrmEntity)
        .find({ where: { scheduleId: In(ids) } }),
    ]);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      venueId: row.venueId,
      uniform: row.uniform,
      notes: row.notes,
      audienceKind: row.audienceKind,
      sections: row.sections,
      status: row.status,
      cancellationReason: row.cancellationReason,
      eventIds: events
        .filter((item) => item.schedule_id === row.id)
        .map((item) => item.event_id),
      userIds: members
        .filter((item) => item.scheduleId === row.id)
        .map((item) => item.userId),
      createdAt: row.createdAt,
    }));
  }
}
