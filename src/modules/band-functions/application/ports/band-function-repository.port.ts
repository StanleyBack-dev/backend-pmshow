import type {
  BandFunction,
  BandFunctionListItem,
} from "@/modules/band-functions/domain/band-function";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type BandFunctionFilter = {
  /** Part of the name (accents ignored). */
  search?: string;
  archived: boolean;
};

export interface BandFunctionRepositoryPort {
  /** By name; archived ones only when asked. */
  list(includeArchived: boolean): Promise<BandFunction[]>;
  /** Catalog page, by name, with the member count. */
  page(
    filter: BandFunctionFilter,
    page: PageRequest,
  ): Promise<Paginated<BandFunctionListItem>>;
  findByIds(ids: readonly string[]): Promise<BandFunction[]>;
  findById(id: string): Promise<BandFunction | null>;
  /** Case-insensitive match, to keep names unique. */
  findByName(name: string): Promise<BandFunction | null>;
  create(data: { name: string }): Promise<BandFunction>;
  update(
    id: string,
    patch: Partial<Pick<BandFunction, "name" | "archived">>,
  ): Promise<BandFunction>;
}

export const BAND_FUNCTION_REPOSITORY = Symbol("BAND_FUNCTION_REPOSITORY");
