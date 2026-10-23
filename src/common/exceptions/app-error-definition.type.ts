import type { HttpStatus } from "@nestjs/common";

export interface AppErrorDefinition<TParams = void> {
  code: string;
  status: HttpStatus;
  message: string | ((params: TParams) => string);
}
