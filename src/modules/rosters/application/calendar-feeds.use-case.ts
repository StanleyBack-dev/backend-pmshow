import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventsUseCase } from "@/modules/events/application/events.use-cases";
import { VenuesUseCase } from "@/modules/events/application/venues.use-cases";
import {
  EventStatus,
  EventType,
  UNIFORM_LABELS,
} from "@/modules/events/domain/event";
import { formatVenueAddress } from "@/modules/events/domain/venue-address";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  buildCalendarFeed,
  type CalendarEntry,
} from "@/modules/notifications/domain/ics";
import {
  CALENDAR_FEED_REPOSITORY,
  type CalendarFeed,
  type CalendarFeedRepositoryPort,
} from "@/modules/rosters/application/ports/calendar-feed-repository.port";
import {
  ROSTER_REPOSITORY,
  type RosterRepositoryPort,
} from "@/modules/rosters/application/ports/roster-repository.port";
import { eventWindow } from "@/modules/rosters/domain/roster";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/** How far back the agenda link keeps events (recent ones stay visible). */
const PAST_DAYS = 30;

// The person's agenda link (iCal): their published rosters and working days,
// for Google Calendar or the iPhone to subscribe to. The link carries a
// random token; making a new one turns the old one off.
@Injectable()
export class CalendarFeedsUseCase {
  private readonly frontendUrl: string;

  constructor(
    @Inject(CALENDAR_FEED_REPOSITORY)
    private readonly feeds: CalendarFeedRepositoryPort,
    @Inject(ROSTER_REPOSITORY) private readonly rosters: RosterRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly events: EventsUseCase,
    private readonly venues: VenuesUseCase,
    private readonly users: UserLookupService,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>("FRONTEND_URL") ?? "").replace(
      /\/$/,
      "",
    );
  }

  mine(userId: string): Promise<CalendarFeed | null> {
    return this.feeds.findByUser(userId);
  }

  /** A new link (the previous one, if any, stops working). */
  renew(userId: string): Promise<CalendarFeed> {
    return this.feeds.save(userId, randomBytes(24).toString("base64url"));
  }

  remove(userId: string): Promise<void> {
    return this.feeds.remove(userId);
  }

  /** The calendar behind a link (null: unknown or turned-off link). */
  async ics(token: string): Promise<string | null> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
    const feed = await this.feeds.findByToken(token);
    if (!feed) return null;
    const user = await this.users.findById(feed.userId);
    if (!user?.active) return null;

    const now = this.clock.now();
    const from = new Date(now.getTime() - PAST_DAYS * 86_400_000);
    const lines = await this.rosters.publishedAssignmentsOf(user.id, from);
    const events = await this.events.findMany(
      lines.map((line) => line.eventId),
    );
    const venueIds = [
      ...new Set(
        events.flatMap((event) => (event.venueId ? [event.venueId] : [])),
      ),
    ];
    const venues = new Map(
      (await this.venues.findMany(venueIds)).map((venue) => [venue.id, venue]),
    );

    const entries: CalendarEntry[] = events.map((event) => {
      const window = eventWindow(event);
      const venue = event.venueId ? venues.get(event.venueId) : undefined;
      const duty = event.type === EventType.EXPEDIENTE;
      return {
        // Same UID as the e-mail attachments: one entry per event.
        uid: `event-${event.id}@pmshow`,
        sequence: Math.floor(event.updatedAt.getTime() / 1000),
        cancelled: event.status === EventStatus.CANCELADO,
        start: window.from,
        end: window.to,
        summary: `PM SHOW · ${duty ? "Expediente" : event.title}`,
        location: venue ? `${venue.name} — ${formatVenueAddress(venue)}` : null,
        description:
          [
            event.uniform ? `Uniforme: ${UNIFORM_LABELS[event.uniform]}` : null,
            event.notes,
          ]
            .filter(Boolean)
            .join("\n") || null,
        url: this.frontendUrl
          ? `${this.frontendUrl}/eventos/${event.id}`
          : null,
      };
    });
    return buildCalendarFeed(`PM SHOW · ${user.name}`, entries, now);
  }
}
