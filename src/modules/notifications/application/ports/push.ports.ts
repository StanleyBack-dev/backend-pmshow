/** A browser/device that accepted notifications (Push API subscription). */
export type PushSubscriptionData = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushMessage = {
  title: string;
  body: string;
  /** App path opened when the notification is tapped. */
  url: string;
  /** Same tag = a newer notification replaces the older one. */
  tag: string;
};

export interface PushSenderPort {
  /** null when VAPID keys are not configured (push disabled). */
  publicKey(): string | null;
  /** "gone": the device unsubscribed or expired — forget it. */
  send(
    subscription: PushSubscriptionData,
    message: PushMessage,
  ): Promise<"sent" | "gone">;
}

export const PUSH_SENDER = Symbol("PUSH_SENDER");

export interface PushSubscriptionRepositoryPort {
  /** Same endpoint again = same device: it now belongs to this user. */
  save(
    userId: string,
    subscription: PushSubscriptionData,
    userAgent: string | null,
  ): Promise<void>;
  listFor(userId: string): Promise<PushSubscriptionData[]>;
  remove(endpoint: string, userId?: string): Promise<boolean>;
  touch(endpoint: string, at: Date): Promise<void>;
}

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol(
  "PUSH_SUBSCRIPTION_REPOSITORY",
);
