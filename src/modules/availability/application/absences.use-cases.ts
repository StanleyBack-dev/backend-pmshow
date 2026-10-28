import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  ABSENCE_REPOSITORY,
  type AbsenceFilter,
  type AbsenceRepositoryPort,
  type AbsenceView,
  type NewAttachment,
} from "@/modules/availability/application/ports/absence-repository.port";
import {
  attachmentKey,
  attachmentPrefix,
  checkAttachmentFiles,
  cleanFileName,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  type AttachmentFile,
  type AttachmentProblem,
} from "@/modules/availability/domain/absence-attachment";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
  type UploadForm,
} from "@/modules/media/application/ports/media.ports";
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
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { formatLocalDate } from "@/shared/domain/local-date";

export type AbsenceInput = Period & {
  type: AbsenceType;
  reason?: string | null;
  /** Files already sent to storage (requestAttachmentUploads). */
  attachments?: { storageKey: string; fileName: string }[];
};

export type AttachmentUpload = { storageKey: string; upload: UploadForm };

const ATTACHMENT_MESSAGES: Record<AttachmentProblem, string> = {
  "too-many": `Anexe no máximo ${MAX_ATTACHMENTS} arquivos.`,
  "unsupported-type": "Anexe só imagens (JPG, PNG, WEBP) ou PDF.",
  "too-large": `Cada arquivo pode ter no máximo ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`,
  empty: "Um dos arquivos está vazio.",
};

/** The signed upload form stays valid this long. */
const UPLOAD_FORM_TTL_SECONDS = 10 * 60;

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
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly members: MembersUseCase,
  ) {}

  /**
   * Step 1 of attaching files: one signed form per file. The browser sends
   * each file straight to storage, which refuses another type or size.
   */
  async requestAttachmentUploads(
    actor: AuthenticatedUser,
    files: readonly AttachmentFile[],
  ): Promise<AttachmentUpload[]> {
    const problem = checkAttachmentFiles(files);
    if (problem) throw this.attachmentError(problem);
    return Promise.all(
      files.map(async (file) => {
        const mimeType = file.mimeType.toLowerCase();
        const storageKey = attachmentKey(actor.id, randomUUID(), mimeType);
        const upload = await this.storage.createUploadForm({
          key: storageKey,
          contentType: mimeType,
          maxBytes: MAX_ATTACHMENT_BYTES,
          expiresInSeconds: UPLOAD_FORM_TTL_SECONDS,
        });
        return { storageKey, upload };
      }),
    );
  }

  /** A short-lived link to view (or download) a file of an absence. */
  async attachmentUrl(
    actor: AuthenticatedUser,
    id: string,
    isManager: boolean,
    download: boolean,
  ): Promise<string> {
    const file = await this.absences.findAttachment(id);
    if (!file || (!isManager && file.userId !== actor.id)) {
      throw AppException.from(
        APP_ERRORS.availability.attachmentNotFound,
        undefined,
      );
    }
    return this.storage.signedReadUrl(
      file.storageKey,
      download ? { downloadName: file.fileName } : undefined,
    );
  }

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
    const attachments = await this.uploadedFiles(
      actor.id,
      input.attachments ?? [],
    );
    const reason = input.reason?.trim() || null;
    const absence = await this.absences.create(
      {
        userId: actor.id,
        type: input.type,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        reason,
        status: AbsenceStatus.PENDENTE,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdBy: actor.id,
      },
      await this.requestedNotices(actor, { ...input, reason }),
      attachments,
    );
    this.outbox.kick();
    await this.stamp(actor, absence.id, true);
    return absence;
  }

  /**
   * The files the member sent: in their own folder, really in storage, and
   * of an accepted type and size (checked again, from the stored object).
   */
  private async uploadedFiles(
    userId: string,
    files: readonly { storageKey: string; fileName: string }[],
  ): Promise<NewAttachment[]> {
    if (files.length > MAX_ATTACHMENTS) throw this.attachmentError("too-many");
    const keys = new Set(files.map((file) => file.storageKey));
    if (keys.size !== files.length) throw this.attachmentError("too-many");
    return Promise.all(
      files.map(async (file) => {
        if (!file.storageKey.startsWith(attachmentPrefix(userId))) {
          throw this.attachmentError("unsupported-type");
        }
        const stored = await this.storage.head(file.storageKey);
        const mimeType = stored?.contentType?.toLowerCase() ?? "";
        if (!stored) {
          throw AppException.from(APP_ERRORS.availability.invalidAttachments, {
            reason: "Um dos arquivos não chegou. Envie de novo.",
          });
        }
        const problem = checkAttachmentFiles([
          { fileName: file.fileName, mimeType, sizeBytes: stored.sizeBytes },
        ]);
        if (problem) throw this.attachmentError(problem);
        return {
          storageKey: file.storageKey,
          fileName: cleanFileName(file.fileName, mimeType),
          mimeType,
          sizeBytes: stored.sizeBytes,
        };
      }),
    );
  }

  private attachmentError(problem: AttachmentProblem): AppException {
    return AppException.from(APP_ERRORS.availability.invalidAttachments, {
      reason: ATTACHMENT_MESSAGES[problem],
    });
  }

  // Every active manager (Gestor group) reviews requests; not the requester.
  private async requestedNotices(
    actor: AuthenticatedUser,
    input: AbsenceInput & { reason: string | null },
  ): Promise<OutboxDraft[]> {
    const managers = (
      await this.users.activeUserIdsInGroup(UserGroup.ADMIN)
    ).filter((id) => id !== actor.id);
    const who = actor.name;
    return managers.map((userId) =>
      deliveryDraft({
        userId,
        type: NotificationType.ABSENCE_REQUESTED,
        title: `${who} pediu indisponibilidade`,
        body: `${describe(input)}${input.reason ? ` — ${input.reason}` : ""}`,
        link: "/indisponibilidades",
        email: {
          subject: `Indisponibilidade para analisar: ${who}`,
          intro: `${who} pediu uma indisponibilidade. Aprove ou recuse no app.`,
          details: [
            { label: "Quem", value: who },
            { label: "Pedido", value: describe(input) },
            ...(input.reason ? [{ label: "Motivo", value: input.reason }] : []),
          ],
          ctaLabel: "Analisar indisponibilidades",
        },
        calendar: null,
      }),
    );
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
    await this.stamp(actor, absence.id, true);
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
    const reviewer = (await this.members.signatureOf(actor)) ?? actor.name;
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
              intro: `${reviewer} ${approve ? "aprovou" : "recusou"} o seu pedido de indisponibilidade.`,
              details: [
                { label: "Pedido", value: describe(absence) },
                {
                  label: approve ? "Aprovado por" : "Recusado por",
                  value: reviewer,
                },
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
    await this.stamp(actor, updated.id);
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
      {
        status: AbsenceStatus.CANCELADA,
        cancelledBy: actor.id,
        cancelledAt: this.clock.now(),
      },
      [],
    );
    await this.stamp(actor, updated.id);
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

  private stamp(
    actor: AuthenticatedUser,
    id: string,
    created = false,
  ): Promise<void> {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "absence",
      entityId: id,
      created,
    });
  }
}
