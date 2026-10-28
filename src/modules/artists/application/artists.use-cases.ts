import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  ARTIST_REPOSITORY,
  type ArtistFilter,
  type ArtistRepositoryPort,
} from "@/modules/artists/application/ports/artist-repository.port";
import {
  artistKey,
  normalizeArtistName,
  type Artist,
  type ArtistListItem,
} from "@/modules/artists/domain/artist";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

@Injectable()
export class ArtistsUseCase {
  constructor(
    @Inject(ARTIST_REPOSITORY) private readonly artists: ArtistRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(includeArchived: boolean): Promise<Artist[]> {
    return this.artists.list(includeArchived);
  }

  page(
    filter: ArtistFilter,
    page: PageRequest,
  ): Promise<Paginated<ArtistListItem>> {
    return this.artists.page(filter, page);
  }

  findMany(ids: readonly string[]): Promise<Artist[]> {
    return this.artists.findByIds(ids);
  }

  /** Throws unless the artist exists and is not archived (used by songs). */
  async getActive(id: string): Promise<Artist> {
    const artist = await this.artists.findById(id);
    if (!artist || artist.archived) {
      throw AppException.from(APP_ERRORS.artists.notFound, undefined);
    }
    return artist;
  }

  /** The artist with this name, ignoring case and accents. */
  findByName(name: string): Promise<Artist | null> {
    return this.artists.findByKey(artistKey(name));
  }

  async create(actor: AuthenticatedUser, rawName: string): Promise<Artist> {
    const name = this.validName(rawName);
    const key = artistKey(name);
    if (await this.artists.findByKey(key)) {
      throw AppException.from(APP_ERRORS.artists.duplicate, undefined);
    }
    const artist = await this.artists.create(name, key, actor.id);
    await this.stamp(actor, artist.id, true);
    return artist;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: { name: string; archived?: boolean },
  ): Promise<Artist> {
    const current = await this.artists.findById(id);
    if (!current) {
      throw AppException.from(APP_ERRORS.artists.notFound, undefined);
    }
    const name = this.validName(input.name);
    const key = artistKey(name);
    const other = await this.artists.findByKey(key);
    if (other && other.id !== id) {
      throw AppException.from(APP_ERRORS.artists.duplicate, undefined);
    }
    const artist = await this.artists.update(id, {
      name,
      key,
      archived: input.archived,
    });
    await this.stamp(actor, artist.id);
    return artist;
  }

  private validName(raw: string): string {
    const name = normalizeArtistName(raw);
    if (!name) {
      throw AppException.from(APP_ERRORS.artists.invalidName, undefined);
    }
    return name;
  }

  private stamp(
    actor: AuthenticatedUser,
    id: string,
    created = false,
  ): Promise<void> {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "artist",
      entityId: id,
      created,
    });
  }
}
