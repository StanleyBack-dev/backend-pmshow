// A function (função) someone has in the band besides playing: conductor,
// driver, sound technician… Kept apart from the instruments so the catalog
// of instruments holds only what is played. Functions are archived, never
// deleted, so old profiles and rosters keep their names.

export type BandFunction = {
  id: string;
  name: string;
  archived: boolean;
};

/** A function in the catalog page, with how many members have it. */
export type BandFunctionListItem = BandFunction & { memberCount: number };

/** Trimmed, single spaces. */
export const normalizeFunctionName = (name: string) =>
  name.trim().replace(/\s+/g, " ");
