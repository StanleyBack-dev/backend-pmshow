import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { GqlContextType } from "@nestjs/graphql";
import type { Request, Response } from "express";
import { reportSystemEvent } from "@/common/logging/system-events";
import { redact } from "@/common/logging/redact";

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

// Normalizes every REST error into `{ statusCode, code, message, details }` so
// the BFF can map failures without knowing Nest's internal error shapes, and
// makes sure unexpected errors never leak stack traces or driver messages.
// GraphQL errors are left to formatGraphqlError (same contract, in
// `extensions`).
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): unknown {
    if (host.getType<GqlContextType>() === "graphql") {
      return exception;
    }

    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);

    // Known business errors (e.g. 503 "not configured") log one line; only
    // unexpected failures get a stack trace.
    const request = host.switchToHttp().getRequest<Request>();
    const source = `${request.method} ${request.path ?? request.url}`;
    if (!(exception instanceof HttpException)) {
      const reason =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(redact(`${body.code}: ${reason}`));
      reportSystemEvent({
        level: "ERROR",
        category: "API",
        source,
        message:
          exception instanceof Error ? exception.message : String(exception),
        statusCode: body.statusCode,
        details: { stack: redact(reason ?? "").slice(0, 2000) },
        alert: true,
      });
    } else if (body.statusCode >= 500) {
      this.logger.warn(redact(`${body.code}: ${body.message}`));
      reportSystemEvent({
        level: "ERROR",
        category: "API",
        source,
        message: `${body.code}: ${body.message}`,
        statusCode: body.statusCode,
        alert: true,
      });
    }

    response.status(body.statusCode).json(body);
    return undefined;
  }

  private toBody(exception: unknown): ErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: "INTERNAL_UNEXPECTED",
        message: "Erro interno inesperado.",
      };
    }

    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === "object" && payload !== null && "code" in payload) {
      const { code, message, details } = payload as Record<string, unknown>;
      return {
        statusCode,
        code: String(code),
        message: String(message),
        details,
      };
    }

    // Nest built-ins (ValidationPipe, unknown route, ...)
    const raw =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>).message
        : payload;
    const isValidation = statusCode === (HttpStatus.BAD_REQUEST as number);

    return {
      statusCode,
      code: isValidation ? "VALIDATION_FAILED" : `HTTP_${statusCode}`,
      message: Array.isArray(raw)
        ? "Dados inválidos."
        : String(raw ?? exception.message),
      details: Array.isArray(raw) ? raw : undefined,
    };
  }
}
