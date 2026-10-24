import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  ABSENCE_REPOSITORY,
  type AbsenceFilter,
  type AbsenceRepositoryPort,
  type AbsenceView,
} from "@/modules/availability/application/ports/absence-repository.port";
import {
  AbsenceStatus,
  canCancel,
  checkPeriod,
  isOpen,
  periodsOverlap,
  type AbsenceType,
  type Period,
  type PeriodViolation,
} from "@/modules/availability/domain/absence";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { formatLocalDate } from "@/shared/domain/local-date";

export type AbsenceInput = Period & {
  type: AbsenceType;
  reason?: string | null;
};

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  FERIAS: "Férias",
  LICENCA: "Licença",
  DISPENSA_MEDICA: "Dispensa médica",
  MISSAO: "Missão",
  CURSO: "Curso",
  OUTRO: "Outro motivo",
};

const PERIOD_MESSAGES: Record<PeriodViolation, string> = {
  "invalid-date": "Data inválida.",
  "ends-before-start": "A data final deve ser igual ou posterior à inicial.",
  "too-long": "O período pode ter no máximo um ano.",
};

const MAX_LIST = 500;

const describe = (absence: Period & { type: AbsenceType }) =>
  absence.startsOn === absence.endsOn
    ? `${ABSENCE_TYPE_LABELS[absence.type]} em ${formatLocalDate(absence.startsOn)}`
    : `${ABSENCE_TYPE_LABELS[absence.type]} de ${formatLocalDate(absence.startsOn)} a ${formatLocalDate(absence.endsOn)}`;

@Injectable()
export class AbsencesUseCase {
  constructor(
    @Inject(ABSENCE_REPOSITORY)
    private readonly absences: AbsenceRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly users: UserLookupService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  listMine(userId: string): Promise<AbsenceView[]> {
    return this.absences.list({ userIds: [userId] }, MAX_LIST);
  }

  list(filter: AbsenceFilter): Promise<AbsenceView[]> {
    return this.absences.list(filter, MAX_LIST);
  }

  /** Approved absences of these users touching the period (for rosters). */
  approvedDuring(
    userIds: readonly string[],
    period: Period,
  ): Promise<AbsenceView[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.absences.list(
      { userIds, statuses: [AbsenceStatus.APROVADA], period },
      MAX_LIST,
    );
  }

  /** A member asks for themself; a manager reviews it later. */
  async request(
    actor: AuthenticatedUser,
    input: AbsenceInput,
  ): Promise<AbsenceView> {
    this.validate(input);
    if (input.endsOn < this.clock.localDate()) {
      throw AppException.from(APP_ERRORS.availability.periodInPast, undefined);
    }
    await this.ensureNoOverlap(actor.id, input);
    const absence = await this.absences.create({
      userId: actor.id,
      type: input.type,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      reason: input.reason?.trim() || null,
      status: AbsenceStatus.PENDENTE,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdBy: actor.id,
    });
    await this.record(actor, "absence.requested", absence);
    return absence;
  }

  /** A manager registers an absence for someone, already approved. */
  async register(
    actor: AuthenticatedUser,
    userId: string,
    input: AbsenceInput,
  ): Promise<AbsenceView> {
    this.validate(input);
    const user = await this.users.findById(userId);
    if (!user?.active) {
      throw AppException.from(APP_ERRORS.availability.userNotFound, undefined);
    }
    await this.ensureNoOverlap(userId, input);
    const absence = await this.absences.create({
      userId,
      type: input.type,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      reason: input.reason?.trim() || null,
      status: AbsenceStatus.APROVADA,
      reviewedBy: actor.id,
      reviewedAt: this.clock.now(),
      reviewNote: null,
      createdBy: actor.id,
    });
    await this.record(actor, "absence.registered", absence);
    return absence;
  }

  async review(
    actor: AuthenticatedUser,
    id: string,
    approve: boolean,
    note: string | null,
  ): Promise<AbsenceView> {
    const absence = await this.get(id);
    if (absence.status !== AbsenceStatus.PENDENTE) {
      throw AppException.from(APP_ERRORS.availability.notPending, undefined);
    }
    if (absence.userId === actor.id) {
      throw AppException.from(APP_ERRORS.availability.selfReview, undefined);
    }
    const status = approve ? AbsenceStatus.APROVADA : AbsenceStatus.RECUSADA;
    const reviewNote = note?.trim() || null;
    const verdict = approve ? "aprovada" : "recusada";
    const updated = await this.absences.setStatus(
      id,
      {
        status,
        reviewedBy: actor.id,
        reviewedAt: this.clock.now(),
        reviewNote,
      },
      [
        deliveryDraft(
          {
            userId: absence.userId,
            type: NotificationType.ABSENCE_REVIEWED,
            title: `Indisponibilidade ${verdict}`,
            body: `${describe(absence)}${reviewNote ? ` — ${reviewNote}` : ""}`,
            link: "/indisponibilidades",
            email: {
              subject: `Sua indisponibilidade foi ${verdict}`,
              intro: `Um gestor ${approve ? "aprovou" : "recusou"} o seu pedido de indisponibilidade.`,
              details: [
                { label: "Pedido", value: describe(absence) },
                ...(reviewNote
                  ? [{ label: "Observação", value: reviewNote }]
                  : []),
              ],
              ctaLabel: "Ver minhas indisponibilidades",
            },
            calendar: null,
          },
          `absence-reviewed:${id}`,
        ),
      ],
    );
    this.outbox.kick();
    await this.record(
      actor,
      `absence.${approve ? "approved" : "denied"}`,
      updated,
    );
    return updated;
  }

  async cancel(
    actor: AuthenticatedUser,
    id: string,
    isManager: boolean,
  ): Promise<AbsenceView> {
    const absence = await this.get(id);
    const allowed = canCancel(absence, {
      isOwner: absence.userId === actor.id,
      isManager,
      today: this.clock.localDate(),
    });
    if (!allowed) {
      throw AppException.from(APP_ERRORS.availability.cannotCancel, undefined);
    }
    const updated = await this.absences.setStatus(
      id,
      { status: AbsenceStatus.CANCELADA },
      [],
    );
    await this.record(actor, "absence.cancelled", updated);
    return updated;
  }

  private async get(id: string): Promise<AbsenceView> {
    const absence = await this.absences.findById(id);
    if (!absence) {
      throw AppException.from(APP_ERRORS.availability.notFound, undefined);
    }
    return absence;
  }

  private validate(input: AbsenceInput): void {
    const violation = checkPeriod(input);
    if (violation) {
      throw AppException.from(APP_ERRORS.availability.invalidPeriod, {
        reason: PERIOD_MESSAGES[violation],
      });
    }
  }

  private async ensureNoOverlap(userId: string, period: Period) {
    const existing = await this.absences.list(
      { userIds: [userId], period },
      MAX_LIST,
    );
    if (existing.some((item) => isOpen(item) && periodsOverlap(item, period))) {
      throw AppException.from(APP_ERRORS.availability.overlap, undefined);
    }
  }

  private record(
    actor: AuthenticatedUser,
    action: string,
    absence: AbsenceView,
  ) {
    return this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action,
      entity: "absence",
      entityId: absence.id,
      after: {
        userId: absence.userId,
        type: absence.type,
        startsOn: absence.startsOn,
        endsOn: absence.endsOn,
        status: absence.status,
      },
    });
  }
}
