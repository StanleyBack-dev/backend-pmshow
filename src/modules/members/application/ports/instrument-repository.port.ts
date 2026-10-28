import type {
  Instrument,
  InstrumentListItem,
  Section,
} from "@/modules/members/domain/member";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type InstrumentFilter = {
  /** Part of the name (accents ignored). */
  search?: string;
  section?: Section;
  archived: boolean;
};

export interface InstrumentRepositoryPort {
  list(includeArchived: boolean): Promise<Instrument[]>;
  /** Catalog page, by section then name, with the member count. */
  page(
    filter: InstrumentFilter,
    page: PageRequest,
  ): Promise<Paginated<InstrumentListItem>>;
  findByIds(ids: readonly string[]): Promise<Instrument[]>;
  findById(id: string): Promise<Instrument | null>;
  /** Case-insensitive match, to keep names unique. */
  findByName(name: string): Promise<Instrument | null>;
  create(data: { name: string; section: Section }): Promise<Instrument>;
  update(
    id: string,
    patch: Partial<Pick<Instrument, "name" | "section" | "archived">>,
  ): Promise<Instrument>;
}

export const INSTRUMENT_REPOSITORY = Symbol("INSTRUMENT_REPOSITORY");
