import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { In, type DataSource, type Repository } from "typeorm";
import type {
  EventData,
  EventFilter,
  EventRepositoryPort,
  VenueData,
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
  address: row.address,
  city: row.city,
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

  async findById(id: string): Promise<BandEvent | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toEvent(row) : null;
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

  async update(id: string, data: Partial<EventData>): Promise<BandEvent> {
    await this.repository.update({ id }, defined(data));
    return toEvent(await this.repository.findOneOrFail({ where: { id } }));
  }

  async setStatus(
    id: string,
    status: EventStatus,
    cancellationReason: string | null,
  ): Promise<BandEvent> {
    await this.repository.update({ id }, { status, cancellationReason });
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
