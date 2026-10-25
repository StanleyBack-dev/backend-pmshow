import type { Artist, ArtistListItem } from "@/modules/artists/domain/artist";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type ArtistFilter = {
  /** Part of the name, ignoring case and accents. */
  search?: string;
  archived: boolean;
  /** true: only artists with songs; false: only without. */
  withSongs?: boolean;
};

export interface ArtistRepositoryPort {
  /** Ordered by name. */
  list(includeArchived: boolean): Promise<Artist[]>;
  /** Paginated, ordered by name, with the number of (non-archived) songs. */
  page(
    filter: ArtistFilter,
    page: PageRequest,
  ): Promise<Paginated<ArtistListItem>>;
  findById(id: string): Promise<Artist | null>;
  findByIds(ids: readonly string[]): Promise<Artist[]>;
  /** Same name ignoring case and accents. */
  findByKey(key: string): Promise<Artist | null>;
  create(name: string, key: string, createdBy: string): Promise<Artist>;
  update(
    id: string,
    patch: { name?: string; key?: string; archived?: boolean },
  ): Promise<Artist>;
}

export const ARTIST_REPOSITORY = Symbol("ARTIST_REPOSITORY");
