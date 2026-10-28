import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { AuthThrottleService } from "@/modules/identity/application/auth-throttle.service";
import { IdentityConfig } from "@/modules/identity/application/identity.config";
import { PasswordService } from "@/modules/identity/application/password.service";
import {
  IDENTITY_NOTIFIER,
  type IdentityNotifierPort,
} from "@/modules/identity/application/ports/identity-notifier.port";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import {
  VERIFICATION_CODE_REPOSITORY,
  type VerificationCodeRepositoryPort,
} from "@/modules/identity/application/ports/verification-code-repository.port";
import type { User } from "@/modules/identity/domain/user";
import {
  isEmailLogin,
  normalizeEmail,
  normalizeUsername,
} from "@/modules/identity/domain/username";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const PURPOSE = "password_recovery" as const;

/**
 * Forgot-password flow in three steps: request (code by e-mail) → verify
 * (code → short-lived reset token) → reset (token + new password). Requests
 * always answer the same way, so they don't reveal which logins exist.
 */
@Injectable()
export class PasswordRecoveryUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly codes: VerificationCodeRepositoryPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(IDENTITY_NOTIFIER) private readonly notifier: IdentityNotifierPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly passwords: PasswordService,
    private readonly audit: AuditTrailService,
    private readonly config: IdentityConfig,
    private readonly throttle: AuthThrottleService,
  ) {}

  async request(login: string, ip: string | null): Promise<void> {
    await this.throttle.consume("recovery-request", ip);
    const user = await this.findActive(login);
    if (!user) return;

    const now = this.clock.now();
    const { recovery } = this.config;
    const recent = await this.codes.countCreatedSince(
      user.id,
      PURPOSE,
      new Date(now.getTime() - 3_600_000),
    );
    if (recent >= recovery.maxCodesPerHour) return;

    const code = this.secrets.numericCode(recovery.codeDigits);
    await this.codes.replaceOpen(
      {
        userId: user.id,
        purpose: PURPOSE,
        codeHash: this.secrets.digest(code),
        maxAttempts: recovery.maxAttempts,
        expiresAt: new Date(now.getTime() + recovery.codeTtlMinutes * 60_000),
      },
      now,
    );
    await this.notifier.recoveryCode(user, code, recovery.codeTtlMinutes);
  }

  /** Returns the reset token that authorizes the final step. */
  async verify(
    login: string,
    code: string,
    ip: string | null,
  ): Promise<string> {
    await this.throttle.consume("recovery-verify", ip);
    const invalid = () =>
      AppException.from(APP_ERRORS.identity.recoveryInvalidCode, undefined);

    const user = await this.findActive(login);
    const open = user ? await this.codes.findOpen(user.id, PURPOSE) : null;
    const now = this.clock.now();
    if (
      !open ||
      open.verifiedAt ||
      open.expiresAt <= now ||
      open.attempts >= open.maxAttempts
    ) {
      throw invalid();
    }

    if (
      !this.secrets.sameDigest(this.secrets.digest(code.trim()), open.codeHash)
    ) {
      await this.codes.update(open.id, { attempts: open.attempts + 1 });
      throw invalid();
    }

    const resetToken = this.secrets.randomToken();
    await this.codes.update(open.id, {
      verifiedAt: now,
      resetTokenHash: this.secrets.digest(resetToken),
      resetTokenExpiresAt: new Date(
        now.getTime() + this.config.recovery.resetTokenTtlMinutes * 60_000,
      ),
    });
    return resetToken;
  }

  async reset(resetToken: string, newPassword: string): Promise<void> {
    const record = await this.codes.findByResetTokenHash(
      this.secrets.digest(resetToken),
    );
    const now = this.clock.now();
    if (
      !record ||
      record.consumedAt ||
      !record.resetTokenExpiresAt ||
      record.resetTokenExpiresAt <= now
    ) {
      throw AppException.from(
        APP_ERRORS.identity.recoveryInvalidResetToken,
        undefined,
      );
    }

    const user = await this.users.findById(record.userId);
    if (!user || !user.active) {
      throw AppException.from(
        APP_ERRORS.identity.recoveryInvalidResetToken,
        undefined,
      );
    }
    this.passwords.assertAcceptable(newPassword, user.username);

    await this.codes.update(record.id, { consumedAt: now });
    await this.passwords.setChosen(user.id, newPassword);
    await this.notifier.passwordChanged(user);
    await this.audit.stamp({
      actorId: user.id,
      entity: "user",
      entityId: user.id,
    });
  }

  private async findActive(login: string): Promise<User | null> {
    const normalized = isEmailLogin(login)
      ? normalizeEmail(login)
      : normalizeUsername(login);
    const user = await this.users.findByLogin(normalized);
    return user?.active ? user : null;
  }
}
