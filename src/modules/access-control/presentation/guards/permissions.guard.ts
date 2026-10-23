import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { requestFromContext } from "@/common/http/request-from-context";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import type { Permission } from "@/modules/access-control/domain/permission";
import { REQUIRED_PERMISSIONS_KEY } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";

// Global guard, registered after the session guard (which sets request.user).
// Operations without @RequirePermissions only need a valid session.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const user = requestFromContext<AuthenticatedRequest>(context).user;
    if (!user) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
      );
    }

    const granted = await this.permissions.effectiveFor(user);
    const missing = required.filter((permission) => !granted.has(permission));
    if (missing.length > 0) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
        { missing },
      );
    }
    return true;
  }
}
