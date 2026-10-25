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
  /** Your absence request was approved or denied. */
  ABSENCE_REVIEWED = "ABSENCE_REVIEWED",
  /** Day before and morning of an event you are on. */
  EVENT_REMINDER = "EVENT_REMINDER",
  /** A manager's announcement (comunicado). */
  BROADCAST = "BROADCAST",
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
