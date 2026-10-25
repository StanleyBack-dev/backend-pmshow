// A singer, band or composer the repertoire refers to. Kept as its own
// record so songs point to one spelling and the list can be filtered by it.

export type Artist = {
  id: string;
  name: string;
  archived: boolean;
  createdAt: Date;
};

/** A row of the artists page: the artist and how many songs use it. */
export type ArtistListItem = Artist & { songCount: number };

export const ARTIST_NAME_LENGTH = { min: 2, max: 120 } as const;

/**
 * Trimmed, single spaces, lowercase (names are stored in lowercase). Null
 * when outside the allowed length.
 */
export function normalizeArtistName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  return name.length >= ARTIST_NAME_LENGTH.min &&
    name.length <= ARTIST_NAME_LENGTH.max
    ? name
    : null;
}

/** Comparison key: no accents, no case ("Zé Ramalho" = "ze ramalho"). */
export function artistKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
