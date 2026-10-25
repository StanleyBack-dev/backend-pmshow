import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { In, type DataSource, type Repository } from "typeorm";
import type {
  EventData,
  EventFilter,
  EventPageFilter,
  EventRepositoryPort,
  VenueData,
  VenueFilter,
  VenueRepositoryPort,
} from "@/modules/events/application/ports/events.ports";
import {
  EventStatus,
  type BandEvent,
  type SetlistItem,
  type Venue,
} from "@/modules/events/domain/event";
import {
  EventOrmEntity,
  EventSongOrmEntity,
  VenueOrmEntity,
} from "@/modules/events/infrastructure/persistence/typeorm/event.orm-entity";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const toEvent = (row: EventOrmEntity): BandEvent => ({
  id: row.id,
  title: row.title,
  type: row.type,
  status: row.status,
  callTime: row.callTime,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  venueId: row.venueId,
  uniform: row.uniform,
  requester: row.requester,
  documentRef: row.documentRef,
  notes: row.notes,
  cancellationReason: row.cancellationReason,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toVenue = (row: VenueOrmEntity): Venue => ({
  id: row.id,
  name: row.name,
  zipCode: row.zipCode,
  street: row.street,
  number: row.number,
  complement: row.complement,
  district: row.district,
  city: row.city,
  state: row.state,
  mapsUrl: row.mapsUrl,
  notes: row.notes,
  archived: row.archived,
});

const defined = <T extends object>(patch: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

@Injectable()
export class EventTypeormRepository implements EventRepositoryPort {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly repository: Repository<EventOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async list(filter: EventFilter, limit: number): Promise<BandEvent[]> {
    const query = this.repository
      .createQueryBuilder("event")
      .orderBy("event.startsAt", "ASC")
      .take(limit);
    if (filter.from) query.andWhere("event.starts_at >= :from", filter);
    if (filter.to) query.andWhere("event.starts_at < :to", filter);
    if (filter.statuses?.length) {
      query.andWhere("event.status IN (:...statuses)", filter);
    }
    if (filter.type) query.andWhere("event.type = :type", filter);
    return (await query.getMany()).map(toEvent);
  }

  async page(
    filter: EventPageFilter,
    page: PageRequest,
  ): Promise<Paginated<BandEvent>> {
    const query = this.repository
      .createQueryBuilder("event")
      .skip((page.page - 1) * page.limit)
      .take(page.limit);
    if (filter.period === "UPCOMING") {
      query
        .where("event.starts_at >= :now", { now: filter.now })
        .orderBy("event.startsAt", "ASC");
    } else if (filter.period === "PAST") {
      query
        .where("event.starts_at < :now", { now: filter.now })
        .orderBy("event.startsAt", "DESC");
    } else {
      query.orderBy("event.startsAt", "DESC");
    }
    const search = filter.search?.trim();
    if (search) {
      query.andWhere("unaccent(event.title) ILIKE unaccent(:term)", {
        term: `%${escapeLike(search)}%`,
      });
    }
    if (filter.statuses?.length) {
      query.andWhere("event.status IN (:...statuses)", {
        statuses: filter.statuses,
      });
    }
    if (filter.type)
      query.andWhere("event.type = :type", { type: filter.type });
    const [rows, total] = await query.getManyAndCount();
    return paginate(rows.map(toEvent), total, page);
  }

  async countSetlists(
    eventIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.dataSource
      .getRepository(EventSongOrmEntity)
      .createQueryBuilder("item")
      .select("item.idtb_events", "eventId")
      .addSelect("count(*)::int", "total")
      .where("item.idtb_events IN (:...ids)", { ids: [...eventIds] })
      .groupBy("item.idtb_events")
      .getRawMany<{ eventId: string; total: number }>();
    return new Map(rows.map((row) => [row.eventId, Number(row.total)]));
  }

  async findById(id: string): Promise<BandEvent | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toEvent(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<BandEvent[]> {
    if (ids.length === 0) return [];
    const rows = await this.repository.find({ where: { id: In([...ids]) } });
    return rows.map(toEvent);
  }

  async create(data: EventData, createdBy: string): Promise<BandEvent> {
    const saved = await this.repository.save(
      this.repository.create({
        ...data,
        status: EventStatus.PLANEJADO,
        createdBy,
      }),
    );
    return toEvent(saved);
  }

  async update(
    id: string,
    data: Partial<EventData>,
    messages: readonly OutboxDraft[],
  ): Promise<BandEvent> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(EventOrmEntity).update({ id }, defined(data));
      await this.outbox.write(manager, messages);
    });
    return toEvent(await this.repository.findOneOrFail({ where: { id } }));
  }

  async setStatus(
    id: string,
    status: EventStatus,
    cancellationReason: string | null,
    messages: readonly OutboxDraft[],
  ): Promise<BandEvent> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(EventOrmEntity)
        .update({ id }, { status, cancellationReason });
      await this.outbox.write(manager, messages);
    });
    return toEvent(await this.repository.findOneOrFail({ where: { id } }));
  }

  async findSetlist(eventId: string): Promise<SetlistItem[]> {
    const rows = await this.dataSource
      .getRepository(EventSongOrmEntity)
      .find({ where: { eventId }, order: { position: "ASC" } });
    return rows.map(({ songId, position, notes }) => ({
      songId,
      position,
      notes,
    }));
  }

  async replaceSetlist(eventId: string, items: SetlistItem[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(EventSongOrmEntity);
      await repository.delete({ eventId });
      if (items.length > 0) {
        await repository.insert(items.map((item) => ({ ...item, eventId })));
      }
    });
  }
}

@Injectable()
export class VenueTypeormRepository implements VenueRepositoryPort {
  constructor(
    @InjectRepository(VenueOrmEntity)
    private readonly repository: Repository<VenueOrmEntity>,
  ) {}

  async list(includeArchived: boolean): Promise<Venue[]> {
    const rows = await this.repository.find({
      where: includeArchived ? {} : { archived: false },
      order: { name: "ASC" },
    });
    return rows.map(toVenue);
  }

  async page(
    filter: VenueFilter,
    page: PageRequest,
  ): Promise<Paginated<Venue>> {
    const query = this.repository
      .createQueryBuilder("venue")
      .where("venue.archived = :archived", { archived: filter.archived })
      .orderBy("venue.name", "ASC")
      .skip((page.page - 1) * page.limit)
      .take(page.limit);
    const search = filter.search?.trim();
    if (search) {
      query.andWhere(
        `unaccent(concat_ws(' ', venue.name, venue.street, venue.district,
           venue.city)) ILIKE unaccent(:term)`,
        { term: `%${escapeLike(search)}%` },
      );
    }
    const [rows, total] = await query.getManyAndCount();
    return paginate(rows.map(toVenue), total, page);
  }

  async findById(id: string): Promise<Venue | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toVenue(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Venue[]> {
    if (ids.length === 0) return [];
    const rows = await this.repository.find({ where: { id: In([...ids]) } });
    return rows.map(toVenue);
  }

  async create(data: VenueData): Promise<Venue> {
    return toVenue(await this.repository.save(this.repository.create(data)));
  }

  async update(
    id: string,
    patch: Partial<VenueData & { archived: boolean }>,
  ): Promise<Venue> {
    await this.repository.update({ id }, defined(patch));
    return toVenue(await this.repository.findOneOrFail({ where: { id } }));
  }
}
