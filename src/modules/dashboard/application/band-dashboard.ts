import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/** What managers need to act on, at a glance. */
export type BandDashboard = {
  activeMembers: number;
  awayMembers: number;
  /** Planned/confirmed events in the next 30 days. */
  upcomingEvents: number;
  /** …of which have no published roster yet. */
  eventsWithoutRoster: number;
  /** Lines on upcoming published rosters still waiting for "ciente". */
  pendingAcks: number;
  /** Upcoming lines where someone asked to be replaced. */
  swapRequests: number;
  pendingAbsences: number;
  /** People with an approved absence today. */
  absentToday: number;
  /** Notifications the outbox gave up on (needs a look). */
  failedNotifications: number;
};

export type DashboardWindow = { now: Date; until: Date; today: string };

export interface DashboardReaderPort {
  read(window: DashboardWindow): Promise<BandDashboard>;
}

export const DASHBOARD_READER = Symbol("DASHBOARD_READER");

const HORIZON_DAYS = 30;

// Read-only aggregates across modules (one round trip). Writes and rules
// stay in each module; this only counts.
@Injectable()
export class BandDashboardUseCase {
  constructor(
    @Inject(DASHBOARD_READER) private readonly reader: DashboardReaderPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  get(): Promise<BandDashboard> {
    const now = this.clock.now();
    return this.reader.read({
      now,
      until: new Date(now.getTime() + HORIZON_DAYS * 86_400_000),
      today: this.clock.localDate(now),
    });
  }
}
