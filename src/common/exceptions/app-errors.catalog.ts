import type { AppErrorDefinition } from "@/common/exceptions/app-error-definition.type";
import { authErrors } from "@/common/exceptions/catalogs/auth-errors.catalog";
import { mailsErrors } from "@/common/exceptions/catalogs/mails-errors.catalog";

export const APP_ERRORS = {
  auth: authErrors,
  mails: mailsErrors,
} as const satisfies Record<string, Record<string, AppErrorDefinition<never>>>;
