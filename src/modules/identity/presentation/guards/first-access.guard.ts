import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "@/common/auth/authenticated-user";
import { ALLOW_FIRST_ACCESS_KEY } from "@/common/decorators/allow-first-access.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { requestFromContext } from "@/common/http/request-from-context";

// While the user still has a temporary password, only @AllowFirstAccess
// operations (me, change password, logout) run. The flag comes from the same
// query that authenticated the request, so this costs nothing extra.
@Injectable()
export class FirstAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = requestFromContext<AuthenticatedRequest>(context).user;
    if (!user?.mustChangePassword) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_FIRST_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;
    throw AppException.from(APP_ERRORS.identity.firstAccessPending, undefined);
  }
}
