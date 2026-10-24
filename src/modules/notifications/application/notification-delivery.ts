import type { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

// The contract producers (rosters, availability…) use to notify someone:
// they build a delivery and store it in the outbox with their own change.

export const NOTIFICATION_TOPIC = "notification.deliver";

export type DeliveryCalendar = {
  uid: string;
  sequence: number;
  cancelled: boolean;
  /** ISO instants (the payload is JSON). */
  start: string;
  end: string;
  summary: string;
  location: string | null;
  description: string | null;
};

export type NotificationDelivery = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  /** null = in-app only. */
  email: {
    subject: string;
    intro: string;
    details: { label: string; value: string }[];
    ctaLabel: string;
  } | null;
  calendar: DeliveryCalendar | null;
};

/**
 * One outbox message per recipient: a failure for one person never resends
 * to the others. `dedupeKey` makes a repeated fan-out harmless.
 */
export function deliveryDraft(
  delivery: NotificationDelivery,
  dedupeKey?: string,
): OutboxDraft {
  return {
    topic: NOTIFICATION_TOPIC,
    payload: delivery as unknown as Record<string, unknown>,
    dedupeKey,
  };
}
