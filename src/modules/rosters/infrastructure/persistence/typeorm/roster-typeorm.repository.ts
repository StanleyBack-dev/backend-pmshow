import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import type {
  BusyEntry,
  EventAssignment,
  MyAssignmentTab,
  RosterRepositoryPort,
  RosterState,
  RosterSummary,
} from "@/modules/rosters/application/ports/roster-repository.port";
import {
  AckStatus,
  type Assignment,
  type Roster,
  type RosterStatus,
  type Window,
} from "@/modules/rosters/domain/roster";
import {
  RosterAssignmentOrmEntity,
  RosterOrmEntity,
} from "@/modules/rosters/infrastructure/persistence/typeorm/roster.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const toEventAssignment = (
  row: RosterAssignmentOrmEntity,
): EventAssignment => ({ ...toAssignment(row), eventId: row.eventId });

const toAssignment = (row: RosterAssignmentOrmEntity): Assignment => ({
  userId: row.userId,
  functionId: row.functionId,
  instrumentId: row.instrumentId,
  notes: row.notes,
  overrideReason: row.overrideReason,
  ackStatus: row.ackStatus,
  ackNote: row.ackNote,
  ackAt: row.ackAt,
});

// The schedule-conflict and "my rosters" queries read tb_events (owned by
// the events module) read-only: filtering by time in SQL instead of loading
// every event.
@Injectable()
export class RosterTypeormRepository implements RosterRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async summaries(
    eventIds: readonly string[],
  ): Promise<Map<string, RosterSummary>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.dataSource
      .getRepository(RosterOrmEntity)
      .createQueryBuilder("roster")
      .select("roster.idtb_events", "eventId")
      .addSelect("roster.status", "status")
      .addSelect(
        `(SELECT count(*)::int FROM tb_roster_assignments a
           WHERE a.idtb_events = roster.idtb_events)`,
        "assignments",
      )
      .where("roster.idtb_events IN (:...ids)", { ids: [...eventIds] })
      .getRawMany<{
        eventId: string;
        status: RosterStatus;
        assignments: number;
      }>();
    return new Map(
      rows.map((row) => [
        row.eventId,
        { status: row.status, assignments: Number(row.assignments) },
      ]),
    );
  }

  async find(eventId: string): Promise<Roster | null> {
    const roster = await this.dataSource
      .getRepository(RosterOrmEntity)
      .findOne({ where: { eventId } });
    if (!roster) return null;
    const rows = await this.dataSource
      .getRepository(RosterAssignmentOrmEntity)
      .find({ where: { eventId } });
    return {
      eventId,
      status: roster.status,
      version: roster.version,
      publishedAt: roster.publishedAt,
      publishedBy: roster.publishedBy,
      assignments: rows.map(toAssignment),
    };
  }

  async save(
    eventId: string,
    state: RosterState,
    notifications: readonly OutboxDraft[],
  ): Promise<Roster> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(RosterOrmEntity).save({
        eventId,
        status: state.status,
        version: state.version,
        publishedAt: state.publishedAt,
        publishedBy: state.publishedBy,
      });
      const lines = manager.getRepository(RosterAssignmentOrmEntity);
      await lines.delete({ eventId });
      if (state.assignments.length > 0) {
        await lines.insert(
          state.assignments.map((item) => ({ ...item, eventId })),
        );
      }
      await this.outbox.write(manager, notifications);
    });
    const saved = await this.find(eventId);
    if (!saved) throw new Error(`Roster ${eventId} vanished after save`);
    return saved;
  }

  async createMany(
    rosters: readonly { eventId: string; state: RosterState }[],
  ): Promise<void> {
    if (rosters.length === 0) return;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(RosterOrmEntity).insert(
        rosters.map(({ eventId, state }) => ({
          eventId,
          status: state.status,
          version: state.version,
          publishedAt: state.publishedAt,
          publishedBy: state.publishedBy,
        })),
      );
      const lines = rosters.flatMap(({ eventId, state }) =>
        state.assignments.map((item) => ({ ...item, eventId })),
      );
      // Chunks keep each statement well under the parameter limit.
      for (let start = 0; start < lines.length; start += 500) {
        await manager
          .getRepository(RosterAssignmentOrmEntity)
          .insert(lines.slice(start, start + 500));
      }
    });
  }

  async setAck(
    eventId: string,
    userId: string,
    ack: { status: AckStatus; note: string | null; at: Date | null },
    notifications: readonly OutboxDraft[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(RosterAssignmentOrmEntity)
        .update(
          { eventId, userId },
          { ackStatus: ack.status, ackNote: ack.note, ackAt: ack.at },
        );
      await this.outbox.write(manager, notifications);
    });
  }

  async busyDuring(
    userIds: readonly string[],
    window: Window,
    excludeEventId: string,
    defaultDurationMs: number,
  ): Promise<BusyEntry[]> {
    if (userIds.length === 0) return [];
    const rows = await this.dataSource.query<
      { user_id: string; event_id: string; title: string }[]
    >(
      `SELECT a.idtb_users AS user_id, e.idtb_events AS event_id, e.title
         FROM tb_roster_assignments a
         JOIN tb_events e ON e.idtb_events = a.idtb_events
        WHERE a.idtb_users = ANY($1::uuid[])
          AND e.idtb_events <> $2
          AND e.status IN ('PLANEJADO', 'CONFIRMADO')
          AND e.type <> 'EXPEDIENTE'
          AND coalesce(e.call_time, e.starts_at) < $4
          AND coalesce(e.ends_at, e.starts_at + make_interval(secs => $5)) > $3
        ORDER BY e.starts_at`,
      [
        userIds,
        excludeEventId,
        window.from,
        window.to,
        defaultDurationMs / 1000,
      ],
    );
    return rows.map((row) => ({
      userId: row.user_id,
      eventId: row.event_id,
      title: row.title,
    }));
  }

  async publishedAssignmentsOf(
    userId: string,
    from: Date,
    acknowledged?: boolean,
  ): Promise<EventAssignment[]> {
    const rows = await this.publishedLines(userId, from, acknowledged)
      .orderBy("e.starts_at", "ASC")
      .limit(100)
      .getMany();
    return rows.map(toEventAssignment);
  }

  async publishedAssignmentsPage(
    userId: string,
    from: Date,
    tab: MyAssignmentTab,
    page: PageRequest,
  ): Promise<Paginated<EventAssignment>> {
    const query = this.tabLines(userId, from, tab)
      .orderBy("e.starts_at", "ASC")
      .offset((page.page - 1) * page.limit)
      .limit(page.limit);
    const [rows, total] = await Promise.all([
      query.getMany(),
      query.getCount(),
    ]);
    return paginate(rows.map(toEventAssignment), total, page);
  }

  async swapRequestsPage(
    from: Date,
    page: PageRequest,
  ): Promise<Paginated<EventAssignment>> {
    const query = this.dataSource
      .getRepository(RosterAssignmentOrmEntity)
      .createQueryBuilder("a")
      .innerJoin(RosterOrmEntity, "r", "r.idtb_events = a.idtb_events")
      .innerJoin("tb_events", "e", "e.idtb_events = a.idtb_events")
      .where("a.ack_status = :swap", { swap: AckStatus.TROCA_SOLICITADA })
      .andWhere("r.status = 'PUBLICADA'")
      .andWhere("e.status IN ('PLANEJADO', 'CONFIRMADO')")
      .andWhere("e.starts_at >= :from", { from })
      .orderBy("e.starts_at", "ASC")
      .addOrderBy("a.ack_at", "ASC")
      .offset((page.page - 1) * page.limit)
      .limit(page.limit);
    const [rows, total] = await Promise.all([
      query.getMany(),
      query.getCount(),
    ]);
    return paginate(rows.map(toEventAssignment), total, page);
  }

  async publishedLinesOn(
    userId: string,
    eventIds: readonly string[],
  ): Promise<Map<string, Assignment>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.dataSource
      .getRepository(RosterAssignmentOrmEntity)
      .createQueryBuilder("a")
      .innerJoin(RosterOrmEntity, "r", "r.idtb_events = a.idtb_events")
      .where("a.idtb_users = :userId", { userId })
      .andWhere("r.status = 'PUBLICADA'")
      .andWhere("a.idtb_events IN (:...ids)", { ids: [...eventIds] })
      .getMany();
    return new Map(rows.map((row) => [row.eventId, toAssignment(row)]));
  }

  async publishedAssignmentCounts(
    userId: string,
    from: Date,
  ): Promise<Record<MyAssignmentTab, number>> {
    const [pending, acknowledged, duty] = await Promise.all([
      this.tabLines(userId, from, "pending").getCount(),
      this.tabLines(userId, from, "acknowledged").getCount(),
      this.tabLines(userId, from, "duty").getCount(),
    ]);
    return { pending, acknowledged, duty };
  }

  /** Events split by answer; working days (no answer asked) apart. */
  private tabLines(userId: string, from: Date, tab: MyAssignmentTab) {
    const query = this.publishedLines(
      userId,
      from,
      tab === "duty" ? undefined : tab === "acknowledged",
    );
    return tab === "duty"
      ? query.andWhere("e.type = 'EXPEDIENTE'")
      : query.andWhere("e.type <> 'EXPEDIENTE'");
  }

  /** A user's lines on published rosters of events from `from` on. */
  private publishedLines(userId: string, from: Date, acknowledged?: boolean) {
    const query = this.dataSource
      .getRepository(RosterAssignmentOrmEntity)
      .createQueryBuilder("a")
      .innerJoin(RosterOrmEntity, "r", "r.idtb_events = a.idtb_events")
      .innerJoin("tb_events", "e", "e.idtb_events = a.idtb_events")
      .where("a.idtb_users = :userId", { userId })
      .andWhere("r.status = 'PUBLICADA'")
      .andWhere("e.starts_at >= :from", { from });
    if (acknowledged !== undefined) {
      query.andWhere(
        acknowledged ? "a.ack_status = :ciente" : "a.ack_status <> :ciente",
        { ciente: AckStatus.CIENTE },
      );
    }
    return query;
  }
}
