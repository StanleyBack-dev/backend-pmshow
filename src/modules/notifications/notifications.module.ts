import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MailModule } from "@/modules/mails/mail.module";
import { NotificationsUseCase } from "@/modules/notifications/application/notifications.use-cases";
import { NOTIFICATION_REPOSITORY } from "@/modules/notifications/application/ports/notification-repository.port";
import {
  PUSH_SENDER,
  PUSH_SUBSCRIPTION_REPOSITORY,
} from "@/modules/notifications/application/ports/push.ports";
import { PushNotificationsService } from "@/modules/notifications/application/push-notifications.service";
import {
  NotificationOrmEntity,
  NotificationPrefOrmEntity,
} from "@/modules/notifications/infrastructure/persistence/typeorm/notification.orm-entity";
import { NotificationTypeormRepository } from "@/modules/notifications/infrastructure/persistence/typeorm/notification-typeorm.repository";
import { PushSubscriptionOrmEntity } from "@/modules/notifications/infrastructure/persistence/typeorm/push-subscription.orm-entity";
import { PushSubscriptionTypeormRepository } from "@/modules/notifications/infrastructure/persistence/typeorm/push-subscription-typeorm.repository";
import { WebPushSender } from "@/modules/notifications/infrastructure/push/web-push.sender";
import { NotificationsResolver } from "@/modules/notifications/presentation/graphql/notifications.resolver";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// In-app inbox plus the e-mail and Web Push channels. Producers never call this module:
// they store a `notification.deliver` message in the outbox (see
// notification-delivery.ts), and this module delivers it.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationOrmEntity,
      NotificationPrefOrmEntity,
      PushSubscriptionOrmEntity,
    ]),
    IdentityModule,
    MailModule,
    OutboxModule,
  ],
  providers: [
    NotificationsUseCase,
    PushNotificationsService,
    NotificationsResolver,
    { provide: PUSH_SENDER, useClass: WebPushSender },
    {
      provide: PUSH_SUBSCRIPTION_REPOSITORY,
      useClass: PushSubscriptionTypeormRepository,
    },
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: NotificationTypeormRepository,
    },
  ],
})
export class NotificationsModule {}
