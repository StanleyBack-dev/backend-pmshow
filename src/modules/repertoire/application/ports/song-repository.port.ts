import type { Song, SongCategory } from "@/modules/repertoire/domain/song";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type SongFilter = {
  /** Title or artist (case- and accent-insensitive). */
  search?: string;
  category?: SongCategory;
  tag?: string;
  archived: boolean;
};

export type SongData = Omit<
  Song,
  "id" | "archivedAt" | "createdAt" | "updatedAt"
>;

export interface SongRepositoryPort {
  list(filter: SongFilter, page: PageRequest): Promise<Paginated<Song>>;
  findById(id: string): Promise<Song | null>;
  create(data: SongData, createdBy: string): Promise<Song>;
  update(id: string, data: Partial<SongData>): Promise<Song>;
  setArchived(id: string, archivedAt: Date | null): Promise<Song>;
  /** Every tag in use, for the filter. */
  listTags(): Promise<string[]>;
}

export const SONG_REPOSITORY = Symbol("SONG_REPOSITORY");
