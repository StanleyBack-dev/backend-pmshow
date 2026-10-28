import type { Rank } from "@/modules/members/domain/member";

export enum EnrollmentStatus {
  PENDENTE = "PENDENTE",
  APROVADA = "APROVADA",
  RECUSADA = "RECUSADA",
}

/**
 * Code a manager shares with a group of musicians (one per cohort, valid
 * for everyone until it expires or is revoked). Kept readable so the manager
 * can copy it again while it is open; it only opens the form, and nothing
 * becomes an account without a manager's approval.
 */
export type EnrollmentInvite = {
  id: string;
  code: string;
  label: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  /** Requests sent with this code. */
  requestCount: number;
};

export type EnrollmentInstrumentChoice = {
  instrumentId: string;
  primary: boolean;
};

/** What the musician fills in on the public form. */
export type EnrollmentData = {
  fullName: string;
  email: string;
  phone: string;
  military: boolean;
  /** RG militar (5 digits); the login of military members. */
  militaryId: string | null;
  /** CIVIL for civilians. */
  rank: Rank;
  warName: string;
  /** YYYY-MM-DD (required on new sign-ups; null on older ones). */
  birthDate: string | null;
  instruments: EnrollmentInstrumentChoice[];
};

export type EnrollmentRequest = EnrollmentData & {
  id: string;
  inviteId: string | null;
  status: EnrollmentStatus;
  consentAt: Date;
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  /** Account created on approval. */
  userId: string | null;
  /** Profile photo in the object storage (optional). */
  photoKey: string | null;
};

/** Where sign-up photos are stored (a random name, never user input). */
export const enrollmentPhotoKey = (id: string) =>
  `profile-photos/enrollment/${id}.webp`;

export const INVITE_CODE_DIGITS = 6;
export const MILITARY_ID_DIGITS = 5;
/** Civilians log in with "c" + 4 digits: never equal to a 5-digit RG. */
export const CIVIL_USERNAME_DIGITS = 4;

/** "12.345" → "12345"; null unless exactly 5 digits. */
export function normalizeMilitaryId(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length === MILITARY_ID_DIGITS ? digits : null;
}

export const civilUsername = (digits: string) => `c${digits}`;

/** Full name as typed, single spaces; null when too short or too long. */
export function normalizeFullName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 5 && name.length <= 160 && name.includes(" ")
    ? name
    : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

/** Open = not revoked and not expired. */
export function isInviteOpen(invite: EnrollmentInvite, now: Date): boolean {
  return !invite.revokedAt && invite.expiresAt > now;
}
