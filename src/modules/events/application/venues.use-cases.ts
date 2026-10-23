import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  VENUE_REPOSITORY,
  type VenueData,
  type VenueRepositoryPort,
} from "@/modules/events/application/ports/events.ports";
import { normalizeMapsUrl, type Venue } from "@/modules/events/domain/event";

export type VenueInput = {
  name: string;
  address?: string | null;
  city?: string | null;
  mapsUrl?: string | null;
  notes?: string | null;
};

const DEFAULT_CITY = "Goiânia";
const text = (value: string | null | undefined) => value?.trim() || null;

// Reusable places (quartel, praça, teatro…). Archived, never deleted, so
// past events keep their location.
@Injectable()
export class VenuesUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY) private readonly venues: VenueRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(includeArchived: boolean): Promise<Venue[]> {
    return this.venues.list(includeArchived);
  }

  findMany(ids: readonly string[]): Promise<Venue[]> {
    return this.venues.findByIds(ids);
  }

  async create(actor: AuthenticatedUser, input: VenueInput): Promise<Venue> {
    const venue = await this.venues.create(this.toData(input));
    await this.record(actor, "venue.created", venue);
    return venue;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: VenueInput & { archived?: boolean },
  ): Promise<Venue> {
    if (!(await this.venues.findById(id))) {
      throw AppException.from(APP_ERRORS.events.venueNotFound, undefined);
    }
    const venue = await this.venues.update(id, {
      ...this.toData(input),
      archived: input.archived,
    });
    await this.record(actor, "venue.updated", venue);
    return venue;
  }

  private toData(input: VenueInput): VenueData {
    let mapsUrl: string | null = null;
    if (input.mapsUrl?.trim()) {
      mapsUrl = normalizeMapsUrl(input.mapsUrl);
      if (!mapsUrl) {
        throw AppException.from(APP_ERRORS.events.invalidMapsUrl, undefined);
      }
    }
    return {
      name: input.name.trim().replace(/\s+/g, " "),
      address: text(input.address),
      city: text(input.city) ?? DEFAULT_CITY,
      mapsUrl,
      notes: text(input.notes),
    };
  }

  private record(
    actor: AuthenticatedUser,
    action: string,
    venue: Venue,
  ): Promise<void> {
    return this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action,
      entity: "venue",
      entityId: venue.id,
      after: { name: venue.name, archived: venue.archived },
    });
  }
}
