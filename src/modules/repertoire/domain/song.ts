export enum SongCategory {
  HINO = "HINO",
  MARCHA = "MARCHA",
  DOBRADO = "DOBRADO",
  MPB = "MPB",
  SAMBA_PAGODE = "SAMBA_PAGODE",
  SERTANEJO = "SERTANEJO",
  FORRO = "FORRO",
  GOSPEL = "GOSPEL",
  POP_ROCK = "POP_ROCK",
  INSTRUMENTAL = "INSTRUMENTAL",
  INFANTIL = "INFANTIL",
  OUTRO = "OUTRO",
}

/** Whether the band still has to learn the song or already plays it. */
export enum SongStage {
  NOVA = "NOVA",
  CONHECIDA = "CONHECIDA",
}

export type Song = {
  id: string;
  title: string;
  /** Singer / band (artists module). */
  artistId: string | null;
  stage: SongStage;
  arranger: string | null;
  category: SongCategory;
  /** e.g. "Bb", "F#m". */
  musicalKey: string | null;
  bpm: number | null;
  durationSeconds: number | null;
  lyrics: string | null;
  notes: string | null;
  tags: string[];
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const BPM_RANGE = { min: 20, max: 300 } as const;
export const DURATION_RANGE = { min: 1, max: 60 * 60 } as const;
export const MAX_TAGS = 10;

const KEY_PATTERN = /^([A-G])([#b]?)(m?)$/;

/**
 * Canonical key: "bb" → "Bb", "f#M" → "F#m". Returns null when the value is
 * not a key (A–G, optional # or b, optional m for minor).
 */
export function normalizeMusicalKey(value: string): string | null {
  const compact = value.trim().replace(/\s+/g, "");
  if (!compact) return null;
  const letter = compact[0].toUpperCase();
  const rest = compact.slice(1);
  const accidental =
    rest.startsWith("#") || rest.startsWith("b") ? rest[0] : "";
  const mode = rest.slice(accidental.length).toLowerCase();
  const key = `${letter}${accidental}${mode}`;
  return KEY_PATTERN.test(key) ? key : null;
}

/** Titles are stored trimmed, with single spaces and in lowercase. */
export function normalizeSongTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** Lowercase, trimmed, unique, without empty entries; at most MAX_TAGS. */
export function normalizeTags(tags: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const tag of tags) {
    const cleaned = tag.trim().toLowerCase().replace(/\s+/g, " ");
    if (cleaned) unique.add(cleaned.slice(0, 30));
  }
  return [...unique].slice(0, MAX_TAGS);
}

export function inRange(
  value: number,
  range: { min: number; max: number },
): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}
