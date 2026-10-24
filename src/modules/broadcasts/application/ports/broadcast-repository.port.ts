import type { Broadcast } from "@/modules/broadcasts/domain/broadcast";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

export type BroadcastView = Broadcast & { authorName: string | null };

export interface BroadcastRepositoryPort {
  /** Stores the announcement and its deliveries in one transaction. */
  create(
    broadcast: Omit<Broadcast, "id" | "createdAt">,
    deliveries: (broadcastId: string) => OutboxDraft[],
  ): Promise<BroadcastView>;
  /** Most recent first. */
  list(limit: number): Promise<BroadcastView[]>;
}

export const BROADCAST_REPOSITORY = Symbol("BROADCAST_REPOSITORY");
