import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@/modules/access-control/domain/permission";

// Every listed permission is required (AND). Checked by PermissionsGuard
// against the caller's effective permissions on each request, so a revoked
// permission stops working immediately — not when the token expires.
export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
