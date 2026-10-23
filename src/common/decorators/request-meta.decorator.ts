import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { requestFromContext } from "@/common/http/request-from-context";

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

// The API is only reached through the BFF (internal key), so the end user's
// address and browser arrive in headers the BFF sets; the socket would only
// show the BFF itself.
export const CLIENT_IP_HEADER = "x-client-ip";
export const CLIENT_USER_AGENT_HEADER = "x-client-user-agent";

export const CurrentRequestMeta = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestMeta => {
    const request = requestFromContext(context);
    return {
      ipAddress: request.header(CLIENT_IP_HEADER) ?? request.ip ?? null,
      userAgent:
        request.header(CLIENT_USER_AGENT_HEADER) ??
        request.header("user-agent") ??
        null,
    };
  },
);
