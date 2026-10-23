export type Session = {
  id: string;
  userId: string;
  refreshSecretHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date;
};

export type NewSession = {
  id: string;
  userId: string;
  refreshSecretHash: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

export interface SessionRepositoryPort {
  create(session: NewSession): Promise<void>;
  findById(id: string): Promise<Session | null>;
  /** Slides the expiry and records the use. */
  touch(id: string, expiresAt: Date, usedAt: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<void>;
  revokeAllForUser(
    userId: string,
    at: Date,
    exceptSessionId?: string,
  ): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol("SESSION_REPOSITORY");
