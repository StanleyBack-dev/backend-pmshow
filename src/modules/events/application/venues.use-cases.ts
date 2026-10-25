import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  VENUE_REPOSITORY,
  ZIP_CODE_LOOKUP,
  type VenueData,
  type VenueFilter,
  type VenueRepositoryPort,
  type ZipCodeAddress,
  type ZipCodeLookupPort,
} from "@/modules/events/application/ports/events.ports";
import { normalizeMapsUrl, type Venue } from "@/modules/events/domain/event";
import {
  normalizeAddressNumber,
  normalizeState,
  normalizeZipCode,
} from "@/modules/events/domain/venue-address";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type VenueInput = {
  name: string;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  mapsUrl?: string | null;
  notes?: string | null;
};

const DEFAULT_CITY = "Goiânia";
const DEFAULT_STATE = "GO";
const text = (value: string | null | undefined) => value?.trim() || null;

// Reusable places (quartel, praça, teatro…). Archived, never deleted, so
// past events keep their location.
@Injectable()
export class VenuesUseCase {
  constructor(
    @Inject(VENUE_REPOSITORY) private readonly venues: VenueRepositoryPort,
    @Inject(ZIP_CODE_LOOKUP) private readonly zipCodes: ZipCodeLookupPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(includeArchived: boolean): Promise<Venue[]> {
    return this.venues.list(includeArchived);
  }

  page(filter: VenueFilter, page: PageRequest): Promise<Paginated<Venue>> {
    return this.venues.page(filter, page);
  }

  /** Street, district, city and UF of a CEP (to fill the form). */
  async findZipCode(value: string): Promise<ZipCodeAddress | null> {
    const zipCode = normalizeZipCode(value);
    if (!zipCode) {
      throw AppException.from(APP_ERRORS.events.invalidZipCode, undefined);
    }
    return this.zipCodes.find(zipCode);
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
    let zipCode: string | null = null;
    if (input.zipCode?.trim()) {
      zipCode = normalizeZipCode(input.zipCode);
      if (!zipCode) {
        throw AppException.from(APP_ERRORS.events.invalidZipCode, undefined);
      }
    }
    let number: string | null = null;
    if (input.number?.trim()) {
      number = normalizeAddressNumber(input.number);
      if (!number) {
        throw AppException.from(
          APP_ERRORS.events.invalidAddressNumber,
          undefined,
        );
      }
    }
    let state = DEFAULT_STATE;
    if (input.state?.trim()) {
      const normalized = normalizeState(input.state);
      if (!normalized) {
        throw AppException.from(APP_ERRORS.events.invalidState, undefined);
      }
      state = normalized;
    }
    const oneLine = (value: string | null | undefined) =>
      text(value)?.replace(/\s+/g, " ") ?? null;
    return {
      name: input.name.trim().replace(/\s+/g, " "),
      zipCode,
      street: oneLine(input.street),
      number,
      complement: oneLine(input.complement),
      district: oneLine(input.district),
      city: oneLine(input.city) ?? DEFAULT_CITY,
      state,
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
