import type { AppErrorDefinition } from "@/common/exceptions/app-error-definition.type";
import { accessControlErrors } from "@/common/exceptions/catalogs/access-control-errors.catalog";
import { authErrors } from "@/common/exceptions/catalogs/auth-errors.catalog";
import { identityErrors } from "@/common/exceptions/catalogs/identity-errors.catalog";
import { mailsErrors } from "@/common/exceptions/catalogs/mails-errors.catalog";

export const APP_ERRORS = {
  accessControl: accessControlErrors,
  auth: authErrors,
  identity: identityErrors,
  mails: mailsErrors,
} as const satisfies Record<string, Record<string, AppErrorDefinition<never>>>;
