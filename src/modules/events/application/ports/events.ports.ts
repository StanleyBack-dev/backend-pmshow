import type {
  BandEvent,
  EventStatus,
  EventType,
  SetlistItem,
  Venue,
} from "@/modules/events/domain/event";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

export type EventFilter = {
  /** Events starting at or after this instant. */
  from?: Date;
  /** Events starting before this instant. */
  to?: Date;
  statuses?: EventStatus[];
  type?: EventType;
};

export type EventData = Omit<
  BandEvent,
  "id" | "status" | "cancellationReason" | "createdAt" | "updatedAt"
>;

export interface EventRepositoryPort {
  /** Ordered by start; capped at `limit`. */
  list(filter: EventFilter, limit: number): Promise<BandEvent[]>;
  findById(id: string): Promise<BandEvent | null>;
  findByIds(ids: readonly string[]): Promise<BandEvent[]>;
  create(data: EventData, createdBy: string): Promise<BandEvent>;
  /** The change and its outbox messages, in one transaction. */
  update(
    id: string,
    data: Partial<EventData>,
    messages: readonly OutboxDraft[],
  ): Promise<BandEvent>;
  setStatus(
    id: string,
    status: EventStatus,
    cancellationReason: string | null,
    messages: readonly OutboxDraft[],
  ): Promise<BandEvent>;
  findSetlist(eventId: string): Promise<SetlistItem[]>;
  replaceSetlist(eventId: string, items: SetlistItem[]): Promise<void>;
}

export const EVENT_REPOSITORY = Symbol("EVENT_REPOSITORY");

export type VenueData = Omit<Venue, "id" | "archived">;

export interface VenueRepositoryPort {
  list(includeArchived: boolean): Promise<Venue[]>;
  findById(id: string): Promise<Venue | null>;
  findByIds(ids: readonly string[]): Promise<Venue[]>;
  create(data: VenueData): Promise<Venue>;
  update(
    id: string,
    patch: Partial<VenueData & { archived: boolean }>,
  ): Promise<Venue>;
}

export const VENUE_REPOSITORY = Symbol("VENUE_REPOSITORY");
