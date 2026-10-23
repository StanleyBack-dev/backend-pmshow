import type { AppErrorDefinition } from "@/common/exceptions/app-error-definition.type";
import { accessControlErrors } from "@/common/exceptions/catalogs/access-control-errors.catalog";
import { authErrors } from "@/common/exceptions/catalogs/auth-errors.catalog";
import { eventsErrors } from "@/common/exceptions/catalogs/events-errors.catalog";
import { identityErrors } from "@/common/exceptions/catalogs/identity-errors.catalog";
import { mailsErrors } from "@/common/exceptions/catalogs/mails-errors.catalog";
import { mediaErrors } from "@/common/exceptions/catalogs/media-errors.catalog";
import { membersErrors } from "@/common/exceptions/catalogs/members-errors.catalog";
import { repertoireErrors } from "@/common/exceptions/catalogs/repertoire-errors.catalog";

export const APP_ERRORS = {
  accessControl: accessControlErrors,
  auth: authErrors,
  events: eventsErrors,
  identity: identityErrors,
  mails: mailsErrors,
  media: mediaErrors,
  members: membersErrors,
  repertoire: repertoireErrors,
} as const satisfies Record<string, Record<string, AppErrorDefinition<never>>>;
