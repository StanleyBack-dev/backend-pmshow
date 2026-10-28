/** A person's secret agenda link (the token goes in the URL). */
export type CalendarFeed = { userId: string; token: string; createdAt: Date };

export interface CalendarFeedRepositoryPort {
  findByUser(userId: string): Promise<CalendarFeed | null>;
  findByToken(token: string): Promise<CalendarFeed | null>;
  /** Creates or replaces the person's link (the old one stops working). */
  save(userId: string, token: string): Promise<CalendarFeed>;
  remove(userId: string): Promise<void>;
}

export const CALENDAR_FEED_REPOSITORY = Symbol("CALENDAR_FEED_REPOSITORY");
