import type { PermissionOverride } from "@/modules/access-control/domain/permission-policy";

export interface PermissionOverrideRepositoryPort {
  findByUser(userId: string): Promise<PermissionOverride[]>;
  /** Atomically swaps the user's overrides for `overrides`. */
  replaceForUser(
    userId: string,
    overrides: readonly PermissionOverride[],
  ): Promise<void>;
}

export const PERMISSION_OVERRIDE_REPOSITORY = Symbol(
  "PERMISSION_OVERRIDE_REPOSITORY",
);
