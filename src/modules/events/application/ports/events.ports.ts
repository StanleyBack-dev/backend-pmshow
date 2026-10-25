import type {
  BandEvent,
  EventStatus,
  EventType,
  SetlistItem,
  Venue,
} from "@/modules/events/domain/event";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type EventFilter = {
  /** Events starting at or after this instant. */
  from?: Date;
  /** Events starting before this instant. */
  to?: Date;
  statuses?: EventStatus[];
  type?: EventType;
};

/** Upcoming: from now on, soonest first; past: before now, latest first. */
export type EventPeriod = "UPCOMING" | "PAST";

export type EventPageFilter = {
  /** Part of the title, ignoring case and accents. */
  search?: string;
  type?: EventType;
  statuses?: EventStatus[];
  period?: EventPeriod;
  now: Date;
};

export type EventData = Omit<
  BandEvent,
  "id" | "status" | "cancellationReason" | "createdAt" | "updatedAt"
>;

export interface EventRepositoryPort {
  /** Ordered by start; capped at `limit`. */
  list(filter: EventFilter, limit: number): Promise<BandEvent[]>;
  /** The events page: filters, period and pagination. */
  page(
    filter: EventPageFilter,
    page: PageRequest,
  ): Promise<Paginated<BandEvent>>;
  /** Number of songs in each event's setlist (absent: none). */
  countSetlists(eventIds: readonly string[]): Promise<Map<string, number>>;
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

export type VenueFilter = {
  /** Part of the name, street, district or city (ignoring accents). */
  search?: string;
  archived: boolean;
};

export interface VenueRepositoryPort {
  list(includeArchived: boolean): Promise<Venue[]>;
  /** The venues page, ordered by name. */
  page(filter: VenueFilter, page: PageRequest): Promise<Paginated<Venue>>;
  findById(id: string): Promise<Venue | null>;
  findByIds(ids: readonly string[]): Promise<Venue[]>;
  create(data: VenueData): Promise<Venue>;
  update(
    id: string,
    patch: Partial<VenueData & { archived: boolean }>,
  ): Promise<Venue>;
}

export const VENUE_REPOSITORY = Symbol("VENUE_REPOSITORY");

/** The address of a CEP, as the postal service knows it. */
export type ZipCodeAddress = {
  zipCode: string;
  street: string | null;
  district: string | null;
  city: string;
  state: string;
};

export interface ZipCodeLookupPort {
  /** null when the CEP does not exist or the service is unavailable. */
  find(zipCode: string): Promise<ZipCodeAddress | null>;
}

export const ZIP_CODE_LOOKUP = Symbol("ZIP_CODE_LOOKUP");
