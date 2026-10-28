import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  BROADCAST_REPOSITORY,
  type BroadcastRepositoryPort,
  type BroadcastView,
} from "@/modules/broadcasts/application/ports/broadcast-repository.port";
import {
  BroadcastAudience,
  normalizeBroadcast,
  type BroadcastDraft,
  type BroadcastViolation,
} from "@/modules/broadcasts/domain/broadcast";
import { EventsUseCase } from "@/modules/events/application/events.use-cases";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { RostersUseCase } from "@/modules/rosters/application/rosters.use-cases";

const VIOLATION_MESSAGES: Record<BroadcastViolation, string> = {
  "title-length": "O título deve ter de 3 a 120 caracteres.",
  "body-length": "A mensagem deve ter de 3 a 2000 caracteres.",
  "section-required": "Escolha o naipe que recebe o comunicado.",
  "event-required": "Escolha o evento cuja escala recebe o comunicado.",
};

const HISTORY_LIMIT = 50;

@Injectable()
export class BroadcastsUseCase {
  constructor(
    @Inject(BROADCAST_REPOSITORY)
    private readonly broadcasts: BroadcastRepositoryPort,
    private readonly users: UserLookupService,
    private readonly members: MembersUseCase,
    private readonly events: EventsUseCase,
    private readonly rosters: RostersUseCase,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  list(): Promise<BroadcastView[]> {
    return this.broadcasts.list(HISTORY_LIMIT);
  }

  async send(
    actor: AuthenticatedUser,
    input: BroadcastDraft,
  ): Promise<BroadcastView> {
    const draft = normalizeBroadcast(input);
    if (typeof draft === "string") {
      throw AppException.from(APP_ERRORS.broadcasts.invalid, {
        reason: VIOLATION_MESSAGES[draft],
      });
    }

    const { userIds, link } = await this.audienceOf(draft);
    if (userIds.length === 0) {
      throw AppException.from(APP_ERRORS.broadcasts.noRecipients, undefined);
    }
    const sender = (await this.members.signatureOf(actor)) ?? actor.name;

    const saved = await this.broadcasts.create(
      {
        ...draft,
        recipients: userIds.length,
        createdBy: actor.id,
      },
      (broadcastId) =>
        userIds.map((userId) =>
          deliveryDraft(
            {
              userId,
              type: NotificationType.BROADCAST,
              title: draft.title,
              body: draft.body,
              link,
              email: draft.sendEmail
                ? {
                    subject: `Comunicado: ${draft.title}`,
                    intro: draft.body,
                    details: [{ label: "Enviado por", value: sender }],
                    ctaLabel: "Abrir o app",
                  }
                : null,
              calendar: null,
            },
            `broadcast:${broadcastId}:${userId}`,
          ),
        ),
    );
    this.outbox.kick();

    await this.audit.stamp({
      actorId: actor.id,
      entity: "broadcast",
      entityId: saved.id,
      created: true,
    });
    return saved;
  }

  private async audienceOf(
    draft: Required<BroadcastDraft>,
  ): Promise<{ userIds: string[]; link: string }> {
    switch (draft.audience) {
      case BroadcastAudience.TODOS:
        return {
          userIds: await this.users.activeUserIds(),
          link: "/notificacoes",
        };
      case BroadcastAudience.NAIPE: {
        const band = await this.members.bandMembers();
        return {
          userIds: band
            .filter((entry) => entry.profile?.section === draft.section)
            .map((entry) => entry.userId),
          link: "/notificacoes",
        };
      }
      case BroadcastAudience.ESCALA_EVENTO: {
        const eventId = draft.eventId as string;
        await this.events.get(eventId);
        return {
          userIds: await this.rosters.publishedAssignees(eventId),
          link: `/eventos/${eventId}`,
        };
      }
    }
  }
}
