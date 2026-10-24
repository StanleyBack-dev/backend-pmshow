import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { SendNotificationEmailUseCase } from "@/modules/mails/application/use-cases/send-notification-email.use-case";
import {
  NOTIFICATION_TOPIC,
  type NotificationDelivery,
} from "@/modules/notifications/application/notification-delivery";
import { PushNotificationsService } from "@/modules/notifications/application/push-notifications.service";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepositoryPort,
} from "@/modules/notifications/application/ports/notification-repository.port";
import { buildIcs } from "@/modules/notifications/domain/ics";
import {
  ALL_NOTIFICATION_TYPES,
  emailEnabled,
  type Notification,
  type NotificationType,
} from "@/modules/notifications/domain/notification";
import { OutboxHandlers } from "@/modules/outbox/application/outbox-handlers";
import type { OutboxMessage } from "@/modules/outbox/domain/outbox";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type NotificationPreference = {
  type: NotificationType;
  emailEnabled: boolean;
};

@Injectable()
export class NotificationsUseCase implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly users: UserLookupService,
    private readonly mails: SendNotificationEmailUseCase,
    private readonly outbox: OutboxHandlers,
    private readonly pushes: PushNotificationsService,
  ) {}

  onModuleInit(): void {
    this.outbox.register(NOTIFICATION_TOPIC, (message) =>
      this.deliver(message),
    );
  }

  /**
   * In-app first (idempotent), then the e-mail, then the push. A failing
   * e-mail throws, so the outbox retries: the in-app notification is not
   * duplicated and the push (best effort) has not gone out yet.
   */
  async deliver(message: OutboxMessage): Promise<void> {
    const delivery = message.payload as unknown as NotificationDelivery;
    const user = await this.users.findById(delivery.userId);
    if (!user?.active) return;

    await this.notifications.createOnce(message.id, {
      userId: user.id,
      type: delivery.type,
      title: delivery.title,
      body: delivery.body,
      link: delivery.link,
    });

    if (delivery.email) {
      const overrides = await this.notifications.emailOverrides(user.id);
      if (emailEnabled(delivery.type, overrides)) {
        await this.sendEmail(user, delivery, delivery.email);
      }
    }

    await this.pushes.sendTo(user.id, {
      title: delivery.title,
      body: delivery.body,
      url: delivery.link ?? "/notificacoes",
      // A newer notice about the same thing replaces the older one.
      tag: `${delivery.type}:${delivery.link ?? message.id}`,
    });
  }

  private async sendEmail(
    user: { name: string; email: string },
    delivery: NotificationDelivery,
    email: NonNullable<NotificationDelivery["email"]>,
  ): Promise<void> {
    const calendar = delivery.calendar;
    await this.mails.send({
      to: { email: user.email, name: user.name },
      recipientName: user.name,
      subject: email.subject,
      intro: email.intro,
      details: email.details,
      ctaLabel: email.ctaLabel,
      link: delivery.link ?? "/inicio",
      tag: `notification-${delivery.type.toLowerCase()}`,
      attachments: calendar
        ? [
            {
              name: "evento.ics",
              contentType: "text/calendar; charset=utf-8",
              content: buildIcs(
                {
                  ...calendar,
                  start: new Date(calendar.start),
                  end: new Date(calendar.end),
                  url: null,
                },
                this.clock.now(),
              ),
            },
          ]
        : undefined,
    });
  }

  list(
    userId: string,
    unreadOnly: boolean,
    page: PageRequest,
  ): Promise<Paginated<Notification>> {
    return this.notifications.list(userId, unreadOnly, page);
  }

  unreadCount(userId: string): Promise<number> {
    return this.notifications.countUnread(userId);
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const found = await this.notifications.markRead(
      userId,
      id,
      this.clock.now(),
    );
    if (!found) {
      throw AppException.from(
        APP_ERRORS.notifications.notificationNotFound,
        undefined,
      );
    }
    return true;
  }

  /** Read notifications older than a year go (daily maintenance). */
  purgeOldRead(now: Date): Promise<number> {
    return this.notifications.purgeReadBefore(
      new Date(now.getTime() - 365 * 86_400_000),
    );
  }

  markAllRead(userId: string): Promise<number> {
    return this.notifications.markAllRead(userId, this.clock.now());
  }

  async preferences(userId: string): Promise<NotificationPreference[]> {
    const overrides = await this.notifications.emailOverrides(userId);
    return ALL_NOTIFICATION_TYPES.map((type) => ({
      type,
      emailEnabled: emailEnabled(type, overrides),
    }));
  }

  async setPreference(
    userId: string,
    type: NotificationType,
    enabled: boolean,
  ): Promise<NotificationPreference> {
    // Only the difference from the default (on) is stored.
    await this.notifications.setEmailOverride(
      userId,
      type,
      enabled ? null : false,
    );
    return { type, emailEnabled: enabled };
  }
}
