import type { UserGroup } from "@/modules/access-control/domain/user-group";

// Everything the session guard needs, read in a single query (the API runs
// on serverless functions: one round trip per request matters).
export type Principal = {
  sessionId: string;
  sessionRevokedAt: Date | null;
  sessionExpiresAt: Date;
  userId: string;
  name: string;
  username: string;
  email: string;
  group: UserGroup;
  active: boolean;
  mustChangePassword: boolean;
};

export interface PrincipalReaderPort {
  findBySession(sessionId: string): Promise<Principal | null>;
}

export const PRINCIPAL_READER = Symbol("PRINCIPAL_READER");
