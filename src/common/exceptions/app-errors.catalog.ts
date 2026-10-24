import type { AppErrorDefinition } from "@/common/exceptions/app-error-definition.type";
import { accessControlErrors } from "@/common/exceptions/catalogs/access-control-errors.catalog";
import { availabilityErrors } from "@/common/exceptions/catalogs/availability-errors.catalog";
import { broadcastsErrors } from "@/common/exceptions/catalogs/broadcasts-errors.catalog";
import { authErrors } from "@/common/exceptions/catalogs/auth-errors.catalog";
import { eventsErrors } from "@/common/exceptions/catalogs/events-errors.catalog";
import { identityErrors } from "@/common/exceptions/catalogs/identity-errors.catalog";
import { mailsErrors } from "@/common/exceptions/catalogs/mails-errors.catalog";
import { mediaErrors } from "@/common/exceptions/catalogs/media-errors.catalog";
import { membersErrors } from "@/common/exceptions/catalogs/members-errors.catalog";
import { notificationsErrors } from "@/common/exceptions/catalogs/notifications-errors.catalog";
import { repertoireErrors } from "@/common/exceptions/catalogs/repertoire-errors.catalog";
import { rostersErrors } from "@/common/exceptions/catalogs/rosters-errors.catalog";

export const APP_ERRORS = {
  accessControl: accessControlErrors,
  auth: authErrors,
  availability: availabilityErrors,
  broadcasts: broadcastsErrors,
  events: eventsErrors,
  identity: identityErrors,
  mails: mailsErrors,
  media: mediaErrors,
  members: membersErrors,
  notifications: notificationsErrors,
  repertoire: repertoireErrors,
  rosters: rostersErrors,
} as const satisfies Record<string, Record<string, AppErrorDefinition<never>>>;
