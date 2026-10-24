import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MailModule } from "@/modules/mails/mail.module";
import { NotificationsUseCase } from "@/modules/notifications/application/notifications.use-cases";
import { NOTIFICATION_REPOSITORY } from "@/modules/notifications/application/ports/notification-repository.port";
import {
  NotificationOrmEntity,
  NotificationPrefOrmEntity,
} from "@/modules/notifications/infrastructure/persistence/typeorm/notification.orm-entity";
import { NotificationTypeormRepository } from "@/modules/notifications/infrastructure/persistence/typeorm/notification-typeorm.repository";
import { NotificationsResolver } from "@/modules/notifications/presentation/graphql/notifications.resolver";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// In-app inbox plus the e-mail channel. Producers never call this module:
// they store a `notification.deliver` message in the outbox (see
// notification-delivery.ts), and this module delivers it.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationOrmEntity,
      NotificationPrefOrmEntity,
    ]),
    IdentityModule,
    MailModule,
    OutboxModule,
  ],
  providers: [
    NotificationsUseCase,
    NotificationsResolver,
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: NotificationTypeormRepository,
    },
  ],
})
export class NotificationsModule {}
