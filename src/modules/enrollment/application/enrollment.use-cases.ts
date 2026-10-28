import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  ENROLLMENT_REPOSITORY,
  type EnrollmentRepositoryPort,
  type EnrollmentRequestFilter,
} from "@/modules/enrollment/application/ports/enrollment-repository.port";
import {
  CIVIL_USERNAME_DIGITS,
  civilUsername,
  enrollmentPhotoKey,
  EnrollmentStatus,
  INVITE_CODE_DIGITS,
  isValidEmail,
  normalizeFullName,
  normalizeMilitaryId,
  type EnrollmentData,
  type EnrollmentInvite,
  type EnrollmentRequest,
} from "@/modules/enrollment/domain/enrollment";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  ManageUsersUseCase,
  type TemporaryAccess,
} from "@/modules/identity/application/use-cases/manage-users.use-cases";
import { normalizeEmail } from "@/modules/identity/domain/username";
import { InstrumentsUseCase } from "@/modules/members/application/use-cases/instruments.use-cases";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import {
  deliveryDraft,
  type NotificationDelivery,
} from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import {
  MemberStatus,
  normalizeInstrumentSelection,
  normalizePhone,
  normalizeWarName,
  Rank,
  type Instrument,
} from "@/modules/members/domain/member";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/modules/media/application/ports/media.ports";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import { decodePhoto } from "@/shared/domain/profile-photo";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";
import { rateStatus, type RateRule } from "@/shared/domain/rate-limit";
import {
  BIRTH_DATE_MESSAGES,
  checkBirthDate,
} from "@/modules/members/domain/member-dates";

/** Time to fill in the form after typing the code. */
const FORM_TTL_MINUTES = 60;
/** Per-IP limits on the public endpoints. */
const LIMITS: Record<"verify" | "submit", RateRule> = {
  verify: { limit: 10, windowMs: 15 * 60_000 },
  submit: { limit: 5, windowMs: 60 * 60_000 },
};

/** What the public form sends (raw, validated here). */
export type EnrollmentInput = {
  fullName: string;
  email: string;
  phone: string;
  military: boolean;
  militaryId?: string | null;
  rank?: Rank | null;
  warName: string;
  birthDate: string;
  instruments: { instrumentId: string; primary: boolean }[];
};

/**
 * Checks and normalizes the form; the instruments must exist and be active.
 * Shared by the public submission and the manager's corrections.
 */
async function validateEnrollment(
  input: EnrollmentInput,
  activeInstruments: () => Promise<Instrument[]>,
): Promise<EnrollmentData> {
  const error = (key: keyof typeof APP_ERRORS.enrollment) =>
    AppException.from(APP_ERRORS.enrollment[key], undefined);

  const fullName = normalizeFullName(input.fullName);
  if (!fullName) throw error("invalidName");

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw error("invalidEmail");

  const phone = normalizePhone(input.phone);
  if (!phone)
    throw AppException.from(APP_ERRORS.members.invalidPhone, undefined);

  let militaryId: string | null = null;
  let rank = Rank.CIVIL;
  if (input.military) {
    militaryId = normalizeMilitaryId(input.militaryId ?? "");
    if (!militaryId) throw error("invalidMilitaryId");
    if (!input.rank || input.rank === Rank.CIVIL) throw error("invalidRank");
    rank = input.rank;
  }

  const warName = normalizeWarName(input.warName);
  if (warName.length < 2 || warName.length > 60) throw error("invalidWarName");

  // The birthday is required on the form (the home page lists them).
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const birth = checkBirthDate(input.birthDate?.slice(0, 10) ?? "", today);
  if (birth) {
    throw AppException.from(APP_ERRORS.members.invalidDate, {
      reason: BIRTH_DATE_MESSAGES[birth],
    });
  }

  const instruments = normalizeInstrumentSelection(input.instruments);
  if (instruments === "multiple-primary") {
    throw AppException.from(
      APP_ERRORS.members.multiplePrimaryInstruments,
      undefined,
    );
  }
  if (instruments.length === 0) throw error("noInstrument");
  const active = new Set((await activeInstruments()).map((item) => item.id));
  if (instruments.some((item) => !active.has(item.instrumentId))) {
    throw AppException.from(APP_ERRORS.members.unknownInstrument, undefined);
  }

  return {
    fullName,
    email,
    phone,
    military: input.military,
    militaryId,
    rank,
    warName,
    birthDate: input.birthDate.slice(0, 10),
    instruments,
  };
}

// === manager: invites ===

@Injectable()
export class EnrollmentInvitesUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly repository: EnrollmentRepositoryPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(): Promise<EnrollmentInvite[]> {
    return this.repository.listInvites(20);
  }

  async create(
    actor: AuthenticatedUser,
    input: { label: string; validDays: number },
  ): Promise<EnrollmentInvite> {
    const label = input.label.trim().replace(/\s+/g, " ");
    if (
      label.length < 2 ||
      label.length > 80 ||
      !Number.isInteger(input.validDays) ||
      input.validDays < 1 ||
      input.validDays > 30
    ) {
      throw AppException.from(APP_ERRORS.enrollment.invalidInvite, undefined);
    }
    const now = this.clock.now();
    // Two open invites never share a code, so a code finds one invite.
    let code = this.secrets.numericCode(INVITE_CODE_DIGITS);
    while (await this.repository.findOpenInviteByCode(code, now)) {
      code = this.secrets.numericCode(INVITE_CODE_DIGITS);
    }
    const invite = await this.repository.createInvite({
      code,
      label,
      expiresAt: new Date(now.getTime() + input.validDays * 86_400_000),
      createdBy: actor.id,
    });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "enrollment_invite",
      entityId: invite.id,
      created: true,
    });
    return invite;
  }

  async revoke(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<EnrollmentInvite> {
    const invite = await this.repository.findInvite(id);
    if (!invite) {
      throw AppException.from(APP_ERRORS.enrollment.inviteNotFound, undefined);
    }
    if (invite.revokedAt) return invite;
    const revoked = await this.repository.revokeInvite(id, this.clock.now());
    await this.audit.stamp({
      actorId: actor.id,
      entity: "enrollment_invite",
      entityId: id,
    });
    return revoked;
  }
}

// === public: code → form → request ===

/** Tells a reviewer that a sign-up awaits approval. */
function submittedNotice(
  userId: string,
  data: EnrollmentData,
): NotificationDelivery {
  return {
    userId,
    type: NotificationType.ENROLLMENT_SUBMITTED,
    title: "Novo cadastro aguardando aprovação",
    body: `${data.warName} (${data.fullName}) enviou o cadastro pelo link público.`,
    link: "/admin/cadastros",
    email: {
      subject: `Cadastro aguardando aprovação: ${data.warName}`,
      intro:
        "Um novo cadastro foi enviado pelo link público e aguarda a sua análise.",
      details: [
        { label: "Nome", value: data.fullName },
        { label: "Nome de guerra", value: data.warName },
        {
          label: "Vínculo",
          value: data.militaryId ? `Militar · RG ${data.militaryId}` : "Civil",
        },
        { label: "E-mail", value: data.email },
      ],
      ctaLabel: "Analisar cadastro",
    },
    calendar: null,
  };
}

@Injectable()
export class PublicEnrollmentUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly repository: EnrollmentRepositoryPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly users: UserLookupService,
    private readonly instruments: InstrumentsUseCase,
    private readonly outbox: OutboxDispatcher,
  ) {}

  /** Returns the form token that lets this browser send the form. */
  async verify(code: string, ip: string | null): Promise<string> {
    await this.consume("verify", ip);
    const now = this.clock.now();
    const invite = /^\d{6}$/.test(code.trim())
      ? await this.repository.findOpenInviteByCode(code.trim(), now)
      : null;
    if (!invite) {
      throw AppException.from(APP_ERRORS.enrollment.invalidCode, undefined);
    }
    return this.signFormToken(
      invite.id,
      new Date(now.getTime() + FORM_TTL_MINUTES * 60_000),
    );
  }

  /** Active instruments, for the form (needs a valid form token). */
  async instrumentOptions(formToken: string): Promise<Instrument[]> {
    await this.openInvite(formToken);
    return this.instruments.list(false);
  }

  async submit(
    formToken: string,
    input: EnrollmentInput,
    consent: boolean,
    ip: string | null,
    /** Optional profile photo, base64 (the browser already resized it). */
    photo?: string | null,
  ): Promise<void> {
    const invite = await this.openInvite(formToken);
    if (!consent) {
      throw AppException.from(APP_ERRORS.enrollment.consentRequired, undefined);
    }
    await this.consume("submit", ip);
    const data = await validateEnrollment(input, () =>
      this.instruments.list(false),
    );

    if (
      await this.users.isTaken({
        username: data.militaryId ?? undefined,
        email: data.email,
      })
    ) {
      throw AppException.from(APP_ERRORS.enrollment.alreadyUser, undefined);
    }
    if (await this.repository.findPending(data)) {
      throw AppException.from(APP_ERRORS.enrollment.alreadyPending, undefined);
    }

    // Checked by its content and re-encoded before anything is stored.
    let photoKey: string | null = null;
    if (photo) {
      const raw = decodePhoto(photo);
      const image = raw ? await this.images.profilePhoto(raw) : null;
      if (!image) {
        throw AppException.from(APP_ERRORS.enrollment.invalidPhoto, undefined);
      }
      photoKey = enrollmentPhotoKey(randomUUID());
      await this.storage.put(photoKey, image.data, image.contentType);
    }
    // Only ADMIN_MASTER reviews sign-ups: each one is told by app and e-mail.
    const reviewers = await this.users.activeUserIdsInGroup(
      UserGroup.ADMIN_MASTER,
    );
    try {
      await this.repository.createRequest(
        {
          ...data,
          inviteId: invite.id,
          consentAt: this.clock.now(),
          photoKey,
        },
        (requestId) =>
          reviewers.map((userId) =>
            deliveryDraft(
              submittedNotice(userId, data),
              `enrollment:${requestId}:${userId}`,
            ),
          ),
      );
    } catch (error) {
      if (photoKey) await this.storage.deleteMany([photoKey]).catch(() => {});
      throw error;
    }
    if (reviewers.length > 0) this.outbox.kick();
  }

  // The token carries the invite and its own expiry, signed with the
  // server's HMAC key: nothing to store, nothing to forge.
  private signFormToken(inviteId: string, expiresAt: Date): string {
    const payload = `${inviteId}.${expiresAt.getTime()}`;
    return `${Buffer.from(payload).toString("base64url")}.${this.secrets.digest(`enrollment:${payload}`)}`;
  }

  /** The invite behind a form token; the invite must not be revoked. */
  private async openInvite(formToken: string): Promise<EnrollmentInvite> {
    const expired = () =>
      AppException.from(APP_ERRORS.enrollment.formExpired, undefined);
    const [encoded, signature] = formToken.split(".");
    if (!encoded || !signature) throw expired();
    const payload = Buffer.from(encoded, "base64url").toString();
    if (
      !this.secrets.sameDigest(
        this.secrets.digest(`enrollment:${payload}`),
        signature,
      )
    ) {
      throw expired();
    }
    const [inviteId, expiresAtMs] = payload.split(".");
    const now = this.clock.now();
    if (!inviteId || Number(expiresAtMs) <= now.getTime()) throw expired();
    const invite = await this.repository.findInvite(inviteId);
    // An invite that expires while the form is open still accepts it; a
    // revoked one does not.
    if (!invite || invite.revokedAt) throw expired();
    return invite;
  }

  private async consume(action: keyof typeof LIMITS, ip: string | null) {
    const rule = LIMITS[action];
    const window = await this.limits.hit(
      `enrollment:${action}:${this.secrets.digest(ip ?? "unknown")}`,
      rule.windowMs,
    );
    // `hit` already counted this request: blocked only when it went over.
    const status = rateStatus(
      { ...window, count: window.count - 1 },
      rule,
      this.clock.now(),
    );
    if (status.blocked) {
      throw AppException.from(APP_ERRORS.identity.tooManyRequests, {
        minutes: status.retryAfterMinutes,
      });
    }
  }
}

// === manager: review ===

export type EnrollmentApproval = {
  request: EnrollmentRequest;
  access: TemporaryAccess;
};

@Injectable()
export class EnrollmentReviewUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly repository: EnrollmentRepositoryPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly users: UserLookupService,
    private readonly manageUsers: ManageUsersUseCase,
    private readonly members: MembersUseCase,
    private readonly instruments: InstrumentsUseCase,
    private readonly audit: AuditTrailService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  private readonly logger = new Logger(EnrollmentReviewUseCase.name);

  /** Short-lived link to the photo, for the review (null: none). */
  async photoUrl(request: EnrollmentRequest): Promise<string | null> {
    return request.photoKey
      ? this.storage.signedReadUrl(request.photoKey)
      : null;
  }

  list(
    filter: EnrollmentRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<EnrollmentRequest>> {
    return this.repository.pageRequests(filter, page);
  }

  countPending(): Promise<number> {
    return this.repository.countPending();
  }

  async get(id: string): Promise<EnrollmentRequest> {
    const request = await this.repository.findRequest(id);
    if (!request) {
      throw AppException.from(APP_ERRORS.enrollment.notFound, undefined);
    }
    return request;
  }

  /**
   * Creates the account (regular flow: temporary password by e-mail) and the
   * band profile, with the data as the manager corrected it and the access
   * group the manager chose. Military log in with their RG; civilians get
   * "c" + 4 random digits not yet in use.
   */
  async approve(
    actor: AuthenticatedUser,
    id: string,
    input: EnrollmentInput,
    group: UserGroup,
  ): Promise<EnrollmentApproval> {
    const request = await this.pending(id);
    const instruments = await this.instruments.list(false);
    const data = await validateEnrollment(input, async () => instruments);
    const username = data.militaryId ?? (await this.freeCivilUsername());

    const access = await this.manageUsers.create(actor, {
      name: data.fullName,
      email: data.email,
      username,
      group,
    });
    const primary =
      data.instruments.find((item) => item.primary) ?? data.instruments[0];
    const section = instruments.find(
      (item) => item.id === primary?.instrumentId,
    )?.section;
    // The photo sent with the sign-up becomes the account's photo.
    if (request.photoKey) {
      await this.users.setAvatarKey(access.user.id, request.photoKey);
    }
    await this.members.save(actor, access.user.id, {
      warName: data.warName,
      rank: data.rank,
      phone: data.phone,
      birthDate: data.birthDate,
      // The instrument decides the section; the manager can change it later.
      section: section ?? instruments[0]!.section,
      status: MemberStatus.ATIVO,
      instruments: data.instruments,
    });

    const approved = await this.repository.updateRequest(id, {
      ...data,
      status: EnrollmentStatus.APROVADA,
      reviewedBy: actor.id,
      reviewedAt: this.clock.now(),
      userId: access.user.id,
    });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "enrollment_request",
      entityId: id,
    });
    return { request: approved, access };
  }

  async reject(
    actor: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<EnrollmentRequest> {
    const request = await this.pending(id);
    const text = reason.trim().replace(/\s+/g, " ");
    if (text.length < 3 || text.length > 500) {
      throw AppException.from(APP_ERRORS.enrollment.invalidReason, undefined);
    }
    const rejected = await this.repository.updateRequest(id, {
      status: EnrollmentStatus.RECUSADA,
      reviewedBy: actor.id,
      reviewedAt: this.clock.now(),
      rejectionReason: text,
      // A rejected sign-up keeps no photo (it never became an account).
      photoKey: null,
    });
    if (request.photoKey) {
      await this.storage
        .deleteMany([request.photoKey])
        .catch((error) =>
          this.logger.warn(
            `Foto do cadastro ${id} não removida: ${String(error)}`,
          ),
        );
    }
    await this.audit.stamp({
      actorId: actor.id,
      entity: "enrollment_request",
      entityId: id,
    });
    return rejected;
  }

  private async pending(id: string): Promise<EnrollmentRequest> {
    const request = await this.get(id);
    if (request.status !== EnrollmentStatus.PENDENTE) {
      throw AppException.from(APP_ERRORS.enrollment.notPending, undefined);
    }
    return request;
  }

  /** Draws "c" + 4 digits until one is free (checked in the database). */
  private async freeCivilUsername(): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const username = civilUsername(
        this.secrets.numericCode(CIVIL_USERNAME_DIGITS),
      );
      if (!(await this.users.isTaken({ username }))) return username;
    }
    throw AppException.from(APP_ERRORS.enrollment.noCivilUsername, undefined);
  }
}
