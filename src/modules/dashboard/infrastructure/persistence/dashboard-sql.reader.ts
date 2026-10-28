import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  BandDashboard,
  DashboardReaderPort,
  DashboardWindow,
} from "@/modules/dashboard/application/band-dashboard";

// Reporting query: reads (never writes) the tables of members, events,
// rosters, availability and outbox in a single statement.
@Injectable()
export class DashboardSqlReader implements DashboardReaderPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async read(window: DashboardWindow): Promise<BandDashboard> {
    const [row] = await this.dataSource.query<
      Record<keyof BandDashboard, number>[]
    >(
      `WITH upcoming AS (
         SELECT e.idtb_events, r.status AS roster_status
           FROM tb_events e
           LEFT JOIN tb_rosters r ON r.idtb_events = e.idtb_events
          WHERE e.status IN ('PLANEJADO', 'CONFIRMADO')
            AND e.type <> 'EXPEDIENTE'
            AND e.starts_at >= $1 AND e.starts_at < $2
       ),
       lines AS (
         SELECT a.ack_status
           FROM tb_roster_assignments a
           JOIN upcoming u ON u.idtb_events = a.idtb_events
          WHERE u.roster_status = 'PUBLICADA'
       )
       SELECT
         (SELECT count(*)::int FROM tb_members m
            JOIN tb_users us ON us.idtb_users = m.idtb_users AND us.active
           WHERE m.status = 'ATIVO') AS "activeMembers",
         (SELECT count(*)::int FROM tb_members m
            JOIN tb_users us ON us.idtb_users = m.idtb_users AND us.active
           WHERE m.status = 'AFASTADO') AS "awayMembers",
         (SELECT count(*)::int FROM upcoming) AS "upcomingEvents",
         (SELECT count(*)::int FROM upcoming
           WHERE roster_status IS DISTINCT FROM 'PUBLICADA') AS "eventsWithoutRoster",
         (SELECT count(*)::int FROM lines WHERE ack_status = 'PENDENTE') AS "pendingAcks",
         (SELECT count(*)::int FROM lines WHERE ack_status = 'TROCA_SOLICITADA') AS "swapRequests",
         (SELECT count(*)::int FROM tb_absences WHERE status = 'PENDENTE') AS "pendingAbsences",
         (SELECT count(DISTINCT idtb_users)::int FROM tb_absences
           WHERE status = 'APROVADA' AND starts_on <= $3::date AND ends_on >= $3::date) AS "absentToday",
         (SELECT count(*)::int FROM tb_outbox WHERE status = 'FAILED') AS "failedNotifications"`,
      [window.now, window.until, window.today],
    );
    return row;
  }
}
