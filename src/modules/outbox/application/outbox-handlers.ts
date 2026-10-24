import { Injectable } from "@nestjs/common";
import type { OutboxMessage } from "@/modules/outbox/domain/outbox";

export type OutboxHandler = (message: OutboxMessage) => Promise<void>;

// Topic → handler. Consumer modules register theirs on init, so the outbox
// never depends on them (rosters listens to "event.changed" without the
// events module knowing rosters exist).
@Injectable()
export class OutboxHandlers {
  private readonly handlers = new Map<string, OutboxHandler>();

  register(topic: string, handler: OutboxHandler): void {
    if (this.handlers.has(topic)) {
      throw new Error(`Outbox topic "${topic}" already has a handler`);
    }
    this.handlers.set(topic, handler);
  }

  for(topic: string): OutboxHandler | undefined {
    return this.handlers.get(topic);
  }
}
