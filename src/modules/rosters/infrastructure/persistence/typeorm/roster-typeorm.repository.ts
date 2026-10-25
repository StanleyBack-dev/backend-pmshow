import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import type {
  BusyEntry,
  EventAssignment,
  RosterRepositoryPort,
  RosterState,
  RosterSummary,
} from "@/modules/rosters/application/ports/roster-repository.port";
import type {
  AckStatus,
  Assignment,
  Roster,
  RosterStatus,
  Window,
} from "@/modules/rosters/domain/roster";
import {
  RosterAssignmentOrmEntity,
  RosterOrmEntity,
} from "@/modules/rosters/infrastructure/persistence/typeorm/roster.orm-entity";

const toAssignment = (row: RosterAssignmentOrmEntity): Assignment => ({
  userId: row.userId,
  role: row.role,
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

  async setAck(
    eventId: string,
    userId: string,
    ack: { status: AckStatus; note: string | null; at: Date },
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
  ): Promise<EventAssignment[]> {
    const rows = await this.dataSource
      .getRepository(RosterAssignmentOrmEntity)
      .createQueryBuilder("a")
      .innerJoin(RosterOrmEntity, "r", "r.idtb_events = a.idtb_events")
      .innerJoin("tb_events", "e", "e.idtb_events = a.idtb_events")
      .where("a.idtb_users = :userId", { userId })
      .andWhere("r.status = 'PUBLICADA'")
      .andWhere("e.starts_at >= :from", { from })
      .orderBy("e.starts_at", "ASC")
      .limit(100)
      .getMany();
    return rows.map((row) => ({ ...toAssignment(row), eventId: row.eventId }));
  }
}
