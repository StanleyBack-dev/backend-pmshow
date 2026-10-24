import type {
  Notification,
  NotificationType,
} from "@/modules/notifications/domain/notification";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type NewNotification = Omit<Notification, "id" | "readAt" | "createdAt">;

export interface NotificationRepositoryPort {
  /** Idempotent per source (the outbox message that produced it). */
  createOnce(sourceId: string, notification: NewNotification): Promise<void>;
  list(
    userId: string,
    unreadOnly: boolean,
    page: PageRequest,
  ): Promise<Paginated<Notification>>;
  countUnread(userId: string): Promise<number>;
  /** false when the notification is not the user's. */
  markRead(userId: string, id: string, at: Date): Promise<boolean>;
  markAllRead(userId: string, at: Date): Promise<number>;
  /** Deletes notifications read before `before`. */
  purgeReadBefore(before: Date): Promise<number>;
  emailOverrides(userId: string): Promise<Map<NotificationType, boolean>>;
  /** `enabled = null` drops the override (back to the default). */
  setEmailOverride(
    userId: string,
    type: NotificationType,
    enabled: boolean | null,
  ): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");
