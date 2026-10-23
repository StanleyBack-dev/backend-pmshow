import type { UserGroup } from "@/modules/access-control/domain/user-group";

export type User = {
  id: string;
  name: string;
  email: string;
  /** Login name: lowercase, see username.ts. */
  username: string;
  group: UserGroup;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt: Date | null;
  lastLoginAt: Date | null;
};

/** Login state kept apart from the profile (tb_auth_credentials). */
export type Credential = {
  userId: string;
  passwordHash: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
};
