import type { Instrument, Section } from "@/modules/members/domain/member";

export interface InstrumentRepositoryPort {
  list(includeArchived: boolean): Promise<Instrument[]>;
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
