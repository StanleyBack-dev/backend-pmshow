import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import { GraphQLError, type GraphQLFormattedError } from "graphql";

const logger = new Logger("GraphQL");

type ExceptionBody = {
  code?: string;
  details?: unknown;
  message?: string | string[];
};

// Same contract as the REST filter: every error reaches the BFF as
// `{ message, extensions: { code, statusCode, details } }`, and unexpected
// failures never leak stack traces or driver messages.
export function formatGraphqlError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const originalError =
    error instanceof GraphQLError ? error.originalError : undefined;

  if (originalError instanceof HttpException) {
    const statusCode = originalError.getStatus();
    const response = originalError.getResponse();
    const body: ExceptionBody =
      typeof response === "string" ? { message: response } : response;
    const isValidation =
      !body.code && statusCode === (HttpStatus.BAD_REQUEST as number);

    if (statusCode >= 500) {
      logger.warn(`${body.code ?? "HTTP_EXCEPTION"}: ${String(body.message)}`);
    }

    return {
      message: Array.isArray(body.message)
        ? "Dados inválidos."
        : (body.message ?? "Erro na requisição."),
      path: formattedError.path,
      extensions: {
        code:
          body.code ??
          (isValidation ? "VALIDATION_FAILED" : `HTTP_${statusCode}`),
        statusCode,
        details: Array.isArray(body.message)
          ? body.message
          : (body.details ?? null),
      },
    };
  }

  // GraphQL's own errors (syntax, unknown field, bad variables, depth limit)
  // are client errors and safe to echo — Apollo may wrap them in another
  // GraphQLError. Anything else is an unexpected server failure.
  if (!originalError || originalError instanceof GraphQLError) {
    return {
      message: formattedError.message,
      extensions: {
        code:
          typeof formattedError.extensions?.code === "string"
            ? formattedError.extensions.code
            : "GRAPHQL_VALIDATION_FAILED",
        statusCode: HttpStatus.BAD_REQUEST,
        details: null,
      },
    };
  }

  logger.error(originalError.stack ?? String(originalError));
  return {
    message: "Erro interno inesperado.",
    path: formattedError.path,
    extensions: {
      code: "INTERNAL_UNEXPECTED",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      details: null,
    },
  };
}
