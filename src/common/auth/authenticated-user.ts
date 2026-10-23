import type { Request } from "express";
import type { UserGroup } from "@/modules/access-control/domain/user-group";

// Who is calling, as established by the session guard (identity module) and
// read by the permission guard and by resolvers via @CurrentUser().
export type AuthenticatedUser = {
  id: string;
  sessionId: string;
  name: string;
  username: string;
  email: string;
  group: UserGroup;
  mustChangePassword: boolean;
  /** End user's address as forwarded by the BFF (for the audit trail). */
  ipAddress: string | null;
};

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
