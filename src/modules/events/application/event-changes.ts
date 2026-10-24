import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

// Published by the events module (through the outbox) when something people
// on the event must know about changes. Consumers (rosters) subscribe to the
// topic; events does not know who listens.

export const EVENT_CHANGED_TOPIC = "event.changed";

export type EventChange = {
  eventId: string;
  /** Time or venue changed / event cancelled. */
  change: "RESCHEDULED" | "CANCELLED";
};

export const eventChangedDraft = (change: EventChange): OutboxDraft => ({
  topic: EVENT_CHANGED_TOPIC,
  payload: change,
});
