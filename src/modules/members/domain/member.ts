// A member is a user's profile in the band. Every member has an account
// (decision of 2026-10-23): rosters only reference people who can sign in.

/** Rank (posto/graduação) in the Goiás Military Police, lowest first. */
export enum Rank {
  SOLDADO = "SOLDADO",
  CABO = "CABO",
  TERCEIRO_SARGENTO = "TERCEIRO_SARGENTO",
  SEGUNDO_SARGENTO = "SEGUNDO_SARGENTO",
  PRIMEIRO_SARGENTO = "PRIMEIRO_SARGENTO",
  SUBTENENTE = "SUBTENENTE",
  CADETE = "CADETE",
  ASPIRANTE = "ASPIRANTE",
  SEGUNDO_TENENTE = "SEGUNDO_TENENTE",
  PRIMEIRO_TENENTE = "PRIMEIRO_TENENTE",
  CAPITAO = "CAPITAO",
  MAJOR = "MAJOR",
  TENENTE_CORONEL = "TENENTE_CORONEL",
  CORONEL = "CORONEL",
  /** Civilian staff (sound technician, driver…). */
  CIVIL = "CIVIL",
}

/** Section (naipe) of the band. */
export enum Section {
  MADEIRAS = "MADEIRAS",
  METAIS = "METAIS",
  PERCUSSAO = "PERCUSSAO",
  CORDAS_BASE = "CORDAS_BASE",
  VOCAL = "VOCAL",
  /** Technical staff and support (sound, light, driver…). */
  TECNICA = "TECNICA",
}

export enum MemberStatus {
  ATIVO = "ATIVO",
  /** Temporarily away (leave, mission, training). */
  AFASTADO = "AFASTADO",
  INATIVO = "INATIVO",
}

export type MemberInstrument = {
  instrumentId: string;
  name: string;
  primary: boolean;
};

/** A function (conductor, driver…) on the member's profile. */
export type MemberFunction = {
  functionId: string;
  name: string;
};

export type MemberProfile = {
  userId: string;
  warName: string;
  rank: Rank;
  registration: string | null;
  phone: string | null;
  section: Section;
  status: MemberStatus;
  notes: string | null;
  /** YYYY-MM-DD (null: not filled in yet). */
  birthDate: string | null;
  /** When the person joined the band, YYYY-MM-DD (null: not filled in). */
  joinedOn: string | null;
  instruments: MemberInstrument[];
  functions: MemberFunction[];
  updatedAt: Date;
};

export type Instrument = {
  id: string;
  name: string;
  section: Section;
  archived: boolean;
};

/** An instrument in the catalog page, with how many members play it. */
export type InstrumentListItem = Instrument & { memberCount: number };

/** Digits only; accepts Brazilian landlines (10) and mobiles (11). */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return /^\d{10,11}$/.test(digits) ? digits : null;
}

/** Registration (matrícula): letters/digits, uppercase, no separators. */
export function normalizeRegistration(value: string): string | null {
  const cleaned = value.replace(/[^0-9a-z]/gi, "").toUpperCase();
  return cleaned.length >= 3 && cleaned.length <= 20 ? cleaned : null;
}

/** War name (nome de guerra) as shown on rosters, e.g. "SGT SILVA". */
export function normalizeWarName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Instruments of a member: unique, at most one primary; when none is marked
 * primary, the first one is.
 */
export function normalizeInstrumentSelection(
  selection: readonly { instrumentId: string; primary: boolean }[],
): { instrumentId: string; primary: boolean }[] | "multiple-primary" {
  const seen = new Set<string>();
  const unique = selection.filter(({ instrumentId }) => {
    if (seen.has(instrumentId)) return false;
    seen.add(instrumentId);
    return true;
  });
  const primaries = unique.filter((item) => item.primary).length;
  if (primaries > 1) return "multiple-primary";
  if (primaries === 0 && unique.length > 0) {
    return unique.map((item, index) => ({ ...item, primary: index === 0 }));
  }
  return unique;
}
