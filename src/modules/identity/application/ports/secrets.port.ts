// Random secrets and their one-way digests (refresh secrets, recovery codes,
// reset tokens are stored only as digests).
export interface SecretsPort {
  /** URL-safe random token (≥ 256 bits). */
  randomToken(): string;
  /** Numeric code shown to a person, e.g. "042917". */
  numericCode(digits: number): string;
  /** Readable temporary password that satisfies the password policy. */
  temporaryPassword(): string;
  /** Keyed digest (HMAC) — comparable, never reversible. */
  digest(value: string): string;
  /** Constant-time comparison of two digests. */
  sameDigest(a: string, b: string): boolean;
}

export const SECRETS = Symbol("SECRETS");
