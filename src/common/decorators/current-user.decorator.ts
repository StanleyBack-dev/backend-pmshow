import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "@/common/auth/authenticated-user";
import { requestFromContext } from "@/common/http/request-from-context";

// Injects the authenticated user (set by the session guard). On @Public
// operations there is none, so handlers that use it are always behind it.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    requestFromContext<AuthenticatedRequest>(context).user as AuthenticatedUser,
);
