import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "@/common/auth/authenticated-user";
import { IS_INTERNAL_ROUTE_KEY } from "@/common/decorators/internal-route.decorator";
import { IS_PUBLIC_KEY } from "@/common/decorators/public.decorator";
import { CLIENT_IP_HEADER } from "@/common/decorators/request-meta.decorator";
import { requestFromContext } from "@/common/http/request-from-context";
import { AuthenticateUseCase } from "@/modules/identity/application/use-cases/session.use-cases";

// Global guard: every operation requires a live session of an active user,
// unless @Public() or @InternalRoute(). Sets request.user for the guards and
// resolvers that run after it.
@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticate: AuthenticateUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ||
      this.reflector.getAllAndOverride<boolean>(IS_INTERNAL_ROUTE_KEY, targets)
    ) {
      return true;
    }

    const request = requestFromContext<AuthenticatedRequest>(context);
    const [scheme, token] = (request.header("authorization") ?? "").split(" ");
    request.user = await this.authenticate.execute(
      scheme === "Bearer" && token ? token : null,
      request.header(CLIENT_IP_HEADER) ?? request.ip ?? null,
    );
    return true;
  }
}
