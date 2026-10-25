// Address of a venue, stored in parts (Brazilian format) so it can be
// validated, searched and printed the same way everywhere.

export const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type VenueAddress = {
  /** CEP, 8 digits. */
  zipCode: string | null;
  street: string | null;
  /** "123", "12A" or "S/N". */
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  /** UF, e.g. "GO". */
  state: string;
};

/** "74.000-000" / "74000000" → "74000000"; null when not 8 digits. */
export function normalizeZipCode(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

/** "123", "12a" → "12A", "sn" / "s/n" → "S/N"; null when not a number. */
export function normalizeAddressNumber(value: string): string | null {
  const compact = value.trim().replace(/\s+/g, "").toUpperCase();
  if (/^S\/?N$/.test(compact)) return "S/N";
  return /^\d{1,6}[A-Z]?$/.test(compact) ? compact : null;
}

/** "go" → "GO"; null when not a Brazilian state. */
export function normalizeState(value: string): string | null {
  const state = value.trim().toUpperCase();
  return (BR_STATES as readonly string[]).includes(state) ? state : null;
}

/** "74000000" → "74000-000". */
export const formatZipCode = (zipCode: string) =>
  `${zipCode.slice(0, 5)}-${zipCode.slice(5)}`;

/**
 * One line, for pages, e-mails and PDFs:
 * "Rua X, 123, Bloco B – Setor Y, Goiânia/GO, CEP 74000-000".
 */
export function formatVenueAddress(address: VenueAddress): string {
  const streetLine = [address.street, address.number, address.complement]
    .filter(Boolean)
    .join(", ");
  const place = [streetLine, address.district].filter(Boolean).join(" – ");
  return [
    place,
    `${address.city}/${address.state}`,
    address.zipCode && `CEP ${formatZipCode(address.zipCode)}`,
  ]
    .filter(Boolean)
    .join(", ");
}
