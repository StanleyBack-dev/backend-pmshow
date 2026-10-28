export enum NotificationType {
  /** You were put on a roster (on publish, or added later). */
  ROSTER_PUBLISHED = "ROSTER_PUBLISHED",
  /** Your role or instrument changed on a published roster. */
  ROSTER_UPDATED = "ROSTER_UPDATED",
  /** You were taken off a published roster. */
  ROSTER_REMOVED = "ROSTER_REMOVED",
  /** Time or venue of an event you are on changed. */
  EVENT_RESCHEDULED = "EVENT_RESCHEDULED",
  EVENT_CANCELLED = "EVENT_CANCELLED",
  /** For managers: someone on a roster asked to be replaced. */
  ROSTER_SWAP_REQUESTED = "ROSTER_SWAP_REQUESTED",
  /** Your swap request was not accepted: you stay on the roster. */
  ROSTER_SWAP_DECLINED = "ROSTER_SWAP_DECLINED",
  /** Your absence request was approved or denied. */
  ABSENCE_REVIEWED = "ABSENCE_REVIEWED",
  /** For managers (Gestor): a member asked for an absence to review. */
  ABSENCE_REQUESTED = "ABSENCE_REQUESTED",
  /** You are on an expediente (working days) just launched. */
  DUTY_SCHEDULED = "DUTY_SCHEDULED",
  /** An expediente you were on was cancelled. */
  DUTY_CANCELLED = "DUTY_CANCELLED",
  /** Day before and morning of an event you are on. */
  EVENT_REMINDER = "EVENT_REMINDER",
  /** A manager's announcement (comunicado). */
  BROADCAST = "BROADCAST",
  /** For ADMIN_MASTER: someone asked the app's support. */
  SUPPORT_REQUESTED = "SUPPORT_REQUESTED",
  /** Your support request was answered. */
  SUPPORT_ANSWERED = "SUPPORT_ANSWERED",
  /** Your support request was closed. */
  SUPPORT_FINALIZED = "SUPPORT_FINALIZED",
  /** For ADMIN_MASTER: errors, security events, failed routines. */
  SYSTEM_ALERT = "SYSTEM_ALERT",
  /** For ADMIN_MASTER: a sign-up from the public link awaits review. */
  ENROLLMENT_SUBMITTED = "ENROLLMENT_SUBMITTED",
}

export const ALL_NOTIFICATION_TYPES: readonly NotificationType[] =
  Object.values(NotificationType);

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** App path, e.g. /eventos/<id>. */
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Every type goes by e-mail unless the user turned it off; only the
 * differences from that default are stored.
 */
export function emailEnabled(
  type: NotificationType,
  overrides: ReadonlyMap<NotificationType, boolean>,
): boolean {
  return overrides.get(type) ?? true;
}
