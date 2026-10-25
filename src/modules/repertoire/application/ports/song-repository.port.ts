import type {
  Song,
  SongCategory,
  SongStage,
} from "@/modules/repertoire/domain/song";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type SongFilter = {
  /** Part of the title or the artist's name (case- and accent-insensitive). */
  search?: string;
  /** Exact title, ignoring case and accents (the title filter). */
  title?: string;
  artistId?: string;
  stage?: SongStage;
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
  findByIds(ids: readonly string[]): Promise<Song[]>;
  create(data: SongData, createdBy: string): Promise<Song>;
  update(id: string, data: Partial<SongData>): Promise<Song>;
  setArchived(id: string, archivedAt: Date | null): Promise<Song>;
  /** Every tag in use, for the filter. */
  listTags(): Promise<string[]>;
  /** Distinct titles, for the title filter. */
  listTitles(archived: boolean): Promise<string[]>;
}

export const SONG_REPOSITORY = Symbol("SONG_REPOSITORY");
