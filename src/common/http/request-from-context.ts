import type { ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext, type GqlContextType } from "@nestjs/graphql";
import type { Request } from "express";

// Guards and decorators run for both REST controllers (health, /internal/*)
// and GraphQL resolvers. This returns the underlying Express request in both.
export function requestFromContext<T extends Request = Request>(
  context: ExecutionContext,
): T {
  if (context.getType<GqlContextType>() === "graphql") {
    return GqlExecutionContext.create(context).getContext<{ req: T }>().req;
  }
  return context.switchToHttp().getRequest<T>();
}
