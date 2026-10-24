export type VerificationPurpose = "password_recovery";

export type VerificationCode = {
  id: string;
  userId: string;
  purpose: VerificationPurpose;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
  consumedAt: Date | null;
};

export type NewVerificationCode = Pick<
  VerificationCode,
  "userId" | "purpose" | "codeHash" | "maxAttempts" | "expiresAt"
>;

export interface VerificationCodeRepositoryPort {
  /** Invalidates the user's open codes for `purpose`, then stores this one. */
  replaceOpen(code: NewVerificationCode, at: Date): Promise<void>;
  /** Latest code still open (not consumed, not invalidated). */
  findOpen(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationCode | null>;
  findByResetTokenHash(hash: string): Promise<VerificationCode | null>;
  /** Deletes codes (and their reset tokens) expired before `before`. */
  purgeExpiredBefore(before: Date): Promise<number>;
  countCreatedSince(
    userId: string,
    purpose: VerificationPurpose,
    since: Date,
  ): Promise<number>;
  update(
    id: string,
    patch: Partial<
      Pick<
        VerificationCode,
        | "attempts"
        | "verifiedAt"
        | "resetTokenHash"
        | "resetTokenExpiresAt"
        | "consumedAt"
      >
    >,
  ): Promise<void>;
}

export const VERIFICATION_CODE_REPOSITORY = Symbol(
  "VERIFICATION_CODE_REPOSITORY",
);
