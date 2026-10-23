import { HttpException } from "@nestjs/common";
import type { AppErrorDefinition } from "./app-error-definition.type";

function resolveMessage<TParams>(
  definition: AppErrorDefinition<TParams>,
  params: TParams,
): string {
  if (typeof definition.message === "function") {
    return (definition.message as (args: TParams) => string)(params);
  }

  return definition.message as string;
}

export class AppException extends HttpException {
  constructor(
    definition: AppErrorDefinition<unknown>,
    message: string,
    details?: unknown,
  ) {
    super(
      {
        code: definition.code,
        message,
        details,
      },
      definition.status,
    );
  }

  static from<TParams>(
    definition: AppErrorDefinition<TParams>,
    params: TParams,
    details?: unknown,
  ): AppException {
    return new AppException(
      definition as unknown as AppErrorDefinition<unknown>,
      resolveMessage(definition, params),
      details,
    );
  }
}
