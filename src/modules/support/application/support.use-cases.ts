import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import {
  SUPPORT_REPOSITORY,
  type SupportFilter,
  type SupportRepositoryPort,
  type SupportRequestView,
} from "@/modules/support/application/ports/support-repository.port";
import {
  supportAnsweredNotice,
  supportFinalizedNotice,
  supportRequestedNotice,
} from "@/modules/support/application/support-notices";
import {
  DAILY_SUPPORT_LIMIT,
  SUPPORT_LIMITS,
  SupportStatus,
  checkSupportDraft,
  isOpen,
  remainingToday,
  type SupportCategory,
  type SupportViolation,
} from "@/modules/support/domain/support-request";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type SupportDraft = {
  category: SupportCategory;
  subject: string;
  message: string;
};

/** Where the person stands with today's limit. */
export type SupportQuota = {
  limit: number;
  sentToday: number;
  remaining: number;
  /** When a new request is possible (null: now). */
  nextAllowedAt: Date | null;
};

const VIOLATION_MESSAGES: Record<SupportViolation, string> = {
  "subject-required": "Informe o assunto (pelo menos 3 caracteres).",
  "subject-too-long": `O assunto pode ter até ${SUPPORT_LIMITS.subject} caracteres.`,
  "message-required": "Descreva o que você precisa (pelo menos 10 caracteres).",
  "message-too-long": `A mensagem pode ter até ${SUPPORT_LIMITS.message} caracteres.`,
};

@Injectable()
export class SupportUseCase {
  constructor(
    @Inject(SUPPORT_REPOSITORY)
    private readonly requests: SupportRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly users: UserLookupService,
    private readonly members: MembersUseCase,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  /** Today's limit (calendar day in the app timezone). */
  async quota(userId: string): Promise<SupportQuota> {
    const now = this.clock.now();
    const sentToday = await this.requests.countSince(
      userId,
      this.clock.startOfLocalDate(this.clock.localDate(now)),
    );
    const remaining = remainingToday(sentToday);
    return {
      limit: DAILY_SUPPORT_LIMIT,
      sentToday,
      remaining,
      nextAllowedAt: remaining > 0 ? null : this.clock.startOfNextLocalDay(now),
    };
  }

  /**
   * Anyone signed in asks for help (up to the daily limit); every active
   * administrator (ADMIN_MASTER) is told in the app and by e-mail.
   */
  async send(
    actor: AuthenticatedUser,
    draft: SupportDraft,
  ): Promise<SupportRequestView> {
    const violation = checkSupportDraft(draft);
    if (violation) {
      throw AppException.from(APP_ERRORS.support.invalid, {
        reason: VIOLATION_MESSAGES[violation],
      });
    }
    if ((await this.quota(actor.id)).remaining === 0) {
      throw AppException.from(APP_ERRORS.support.dailyLimit, {
        limit: DAILY_SUPPORT_LIMIT,
      });
    }

    const admins = (
      await this.users.activeUserIdsInGroup(UserGroup.ADMIN_MASTER)
    ).filter((id) => id !== actor.id);
    const requester = (await this.members.signatureOf(actor)) ?? actor.name;
    const created = await this.requests.create(
      {
        userId: actor.id,
        category: draft.category,
        subject: draft.subject.trim(),
        message: draft.message.trim(),
      },
      (saved) =>
        admins.map((adminId) =>
          deliveryDraft(
            supportRequestedNotice(adminId, requester, saved),
            `support:${saved.id}:${adminId}`,
          ),
        ),
    );
    if (admins.length > 0) this.outbox.kick();
    await this.stamp(actor, created.id, true);
    return created;
  }

  /** The person's own requests, most recent first. */
  mine(
    actor: AuthenticatedUser,
    page: PageRequest,
  ): Promise<Paginated<SupportRequestView>> {
    return this.requests.list({ userId: actor.id }, page);
  }

  /** Every request (administrators). */
  list(
    filter: Omit<SupportFilter, "userId">,
    page: PageRequest,
  ): Promise<Paginated<SupportRequestView>> {
    return this.requests.list(filter, page);
  }

  /** Answers (or answers again); the requester is told. */
  async reply(
    actor: AuthenticatedUser,
    id: string,
    text: string,
  ): Promise<SupportRequestView> {
    const request = await this.openRequest(id);
    const reply = text.trim();
    if (reply.length < 2 || reply.length > SUPPORT_LIMITS.reply) {
      throw AppException.from(APP_ERRORS.support.invalid, {
        reason: `Escreva a resposta (até ${SUPPORT_LIMITS.reply} caracteres).`,
      });
    }
    const by = (await this.members.signatureOf(actor)) ?? actor.name;
    const updated = await this.requests.update(
      id,
      {
        status: SupportStatus.RESPONDIDO,
        reply,
        repliedAt: this.clock.now(),
        repliedBy: actor.id,
      },
      [
        deliveryDraft(
          supportAnsweredNotice(request, reply, by),
          `support-answered:${id}:${this.clock.now().getTime()}`,
        ),
      ],
    );
    this.outbox.kick();
    await this.stamp(actor, id);
    return updated;
  }

  /** Closes the request; the requester is told. */
  async finalize(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<SupportRequestView> {
    const request = await this.openRequest(id);
    const by = (await this.members.signatureOf(actor)) ?? actor.name;
    const updated = await this.requests.update(
      id,
      {
        status: SupportStatus.FINALIZADO,
        finalizedAt: this.clock.now(),
        finalizedBy: actor.id,
      },
      [
        deliveryDraft(
          supportFinalizedNotice(request, by),
          `support-finalized:${id}`,
        ),
      ],
    );
    this.outbox.kick();
    await this.stamp(actor, id);
    return updated;
  }

  private async openRequest(id: string): Promise<SupportRequestView> {
    const request = await this.requests.findById(id);
    if (!request) {
      throw AppException.from(APP_ERRORS.support.notFound, undefined);
    }
    if (!isOpen(request.status)) {
      throw AppException.from(APP_ERRORS.support.finalized, undefined);
    }
    return request;
  }

  private stamp(
    actor: AuthenticatedUser,
    id: string,
    created = false,
  ): Promise<void> {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "support_request",
      entityId: id,
      created,
    });
  }
}
