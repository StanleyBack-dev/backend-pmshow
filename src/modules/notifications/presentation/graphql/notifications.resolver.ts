import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import {
  NotificationsUseCase,
  type NotificationPreference,
} from "@/modules/notifications/application/notifications.use-cases";
import { PushNotificationsService } from "@/modules/notifications/application/push-notifications.service";
import {
  NotificationType,
  type Notification,
} from "@/modules/notifications/domain/notification";
import {
  NotificationPage,
  NotificationPreferenceType,
  PushSubscriptionInput,
} from "@/modules/notifications/presentation/graphql/notifications.graphql-types";
import type { Paginated } from "@/shared/application/pagination";

// Each user's own inbox: only a session is needed, never someone else's.
@Resolver()
export class NotificationsResolver {
  constructor(
    private readonly notificationsUseCase: NotificationsUseCase,
    private readonly pushes: PushNotificationsService,
  ) {}

  @Query(() => NotificationPage, { description: "Mais recentes primeiro." })
  myNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Args("unreadOnly", { defaultValue: false }) unreadOnly: boolean,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<Notification>> {
    return this.notificationsUseCase.list(
      user.id,
      unreadOnly,
      page ?? { page: 1, limit: 20 },
    );
  }

  @Query(() => Int)
  unreadNotificationsCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    return this.notificationsUseCase.unreadCount(user.id);
  }

  @Mutation(() => Boolean)
  markNotificationRead(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, new ParseUUIDPipe({ version: "4" }))
    id: string,
  ): Promise<boolean> {
    return this.notificationsUseCase.markRead(user.id, id);
  }

  @Mutation(() => Int, { description: "Quantas foram marcadas." })
  markAllNotificationsRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    return this.notificationsUseCase.markAllRead(user.id);
  }

  @Query(() => [NotificationPreferenceType])
  myNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationPreference[]> {
    return this.notificationsUseCase.preferences(user.id);
  }

  @Mutation(() => NotificationPreferenceType)
  setNotificationPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Args("type", { type: () => NotificationType }) type: NotificationType,
    @Args("emailEnabled") emailEnabled: boolean,
  ): Promise<NotificationPreference> {
    return this.notificationsUseCase.setPreference(user.id, type, emailEnabled);
  }

  @Query(() => String, {
    nullable: true,
    description:
      "Chave VAPID para o navegador assinar o push (null = desligado).",
  })
  pushPublicKey(): string | null {
    return this.pushes.publicKey();
  }

  @Mutation(() => Boolean, { description: "Ativa o push neste aparelho." })
  async subscribePush(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input") input: PushSubscriptionInput,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<boolean> {
    await this.pushes.subscribe(
      user.id,
      input,
      meta.userAgent?.slice(0, 300) ?? null,
    );
    return true;
  }

  @Mutation(() => Boolean, { description: "Desativa o push neste aparelho." })
  unsubscribePush(
    @CurrentUser() user: AuthenticatedUser,
    @Args("endpoint") endpoint: string,
  ): Promise<boolean> {
    return this.pushes.unsubscribe(user.id, endpoint);
  }

  @Mutation(() => Int, {
    description: "Envia um push de teste; devolve quantos aparelhos receberam.",
  })
  sendTestPush(@CurrentUser() user: AuthenticatedUser): Promise<number> {
    return this.pushes.sendTo(user.id, {
      title: "PM SHOW",
      body: "As notificações estão funcionando neste aparelho.",
      url: "/notificacoes",
      tag: "test",
    });
  }
}
