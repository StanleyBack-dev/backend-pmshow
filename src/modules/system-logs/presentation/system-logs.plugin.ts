import { Plugin } from "@nestjs/apollo";
import { HttpException } from "@nestjs/common";
import type {
  ApolloServerPlugin,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from "@apollo/server";
import { GraphQLError } from "graphql";
import type { AuthenticatedRequest } from "@/common/auth/authenticated-user";
import {
  reportSystemEvent,
  type SystemEvent,
} from "@/common/logging/system-events";
import { redact } from "@/common/logging/redact";

type Context = { req?: AuthenticatedRequest };

/** The caller's address: the BFF forwards the end user's one. */
function ipOf(req: AuthenticatedRequest | undefined): string | null {
  if (!req) return null;
  if (req.user?.ipAddress) return req.user.ipAddress;
  const forwarded = req.headers?.["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() || req.ip || null;
}

// Puts the GraphQL failures worth knowing in the system log: unexpected
// errors (code and database), permission denials and throttled requests.
// Ordinary business errors (invalid data, not found) are left out.
@Plugin()
export class SystemLogsPlugin implements ApolloServerPlugin<Context> {
  requestDidStart(): Promise<GraphQLRequestListener<Context>> {
    const startedAt = Date.now();
    return Promise.resolve({
      didEncounterErrors: (ctx: GraphQLRequestContext<Context>) => {
        const req = ctx.contextValue.req;
        const base = {
          source: `GraphQL ${ctx.operationName ?? "(sem nome)"}`,
          userId: req?.user?.id ?? null,
          ip: ipOf(req),
          durationMs: Date.now() - startedAt,
        };
        for (const error of ctx.errors ?? []) {
          const event = classify(error, base);
          if (event) reportSystemEvent(event);
        }
        return Promise.resolve();
      },
    });
  }
}

function classify(
  error: GraphQLError,
  base: Pick<SystemEvent, "source" | "userId" | "ip" | "durationMs">,
): SystemEvent | null {
  const original = error.originalError;
  const path = error.path?.join(".") ?? null;
  if (original instanceof HttpException) {
    const status = original.getStatus();
    const response = original.getResponse();
    const code =
      typeof response === "object" && response && "code" in response
        ? String((response as { code: unknown }).code)
        : `HTTP_${status}`;
    if (status >= 500) {
      return {
        ...base,
        level: "ERROR",
        category: "API",
        message: `${code}: ${original.message}`,
        statusCode: status,
        details: { code, path },
        alert: true,
      };
    }
    if (status === 403) {
      return {
        ...base,
        level: "WARN",
        category: "SECURITY",
        message: `Acesso negado (${code})`,
        statusCode: status,
        details: { code, path },
      };
    }
    if (status === 429) {
      return {
        ...base,
        level: "WARN",
        category: "SECURITY",
        message: `Muitas tentativas (${code})`,
        statusCode: status,
        details: { code, path },
        alert: true,
      };
    }
    return null;
  }
  // GraphQL's own errors (syntax, unknown field) are the client's.
  if (!original || original instanceof GraphQLError) return null;
  const database = /QueryFailed|Typeorm|EntityNotFound|ECONN|ETIMEDOUT/i.test(
    `${original.name} ${original.constructor?.name ?? ""} ${original.message}`,
  );
  return {
    ...base,
    level: "ERROR",
    category: database ? "DATABASE" : "API",
    message: original.message || original.name,
    statusCode: 500,
    details: {
      path,
      error: original.name,
      stack: redact(original.stack ?? "").slice(0, 2000),
    },
    alert: true,
  };
}
