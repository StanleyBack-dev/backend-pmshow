import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepositoryPort,
} from "@/modules/identity/application/ports/credential-repository.port";
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from "@/modules/identity/application/ports/password-hasher.port";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import { UNLOCKED } from "@/modules/identity/domain/lockout-policy";
import { checkPassword } from "@/modules/identity/domain/password-policy";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// Every way a password changes (own change, recovery, admin reset, new
// account) goes through here, so the policy, the unlock and the session
// revocation can't be forgotten in one of them.
@Injectable()
export class PasswordService {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepositoryPort,
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  assertAcceptable(password: string, username: string): void {
    const violations = checkPassword(password, { username });
    if (violations.length > 0) {
      throw AppException.from(APP_ERRORS.identity.weakPassword, undefined, {
        violations,
      });
    }
  }

  /** A person chose this password: no forced change next login. */
  async setChosen(
    userId: string,
    password: string,
    keepSessionId?: string,
  ): Promise<void> {
    await this.store(userId, await this.hasher.hash(password), false);
    await this.sessions.revokeAllForUser(
      userId,
      this.clock.now(),
      keepSessionId,
    );
  }

  /** Generates a temporary password the user must replace at next login. */
  async issueTemporary(userId: string): Promise<string> {
    const temporary = this.secrets.temporaryPassword();
    await this.store(userId, await this.hasher.hash(temporary), true);
    await this.sessions.revokeAllForUser(userId, this.clock.now());
    return temporary;
  }

  async hashTemporary(): Promise<{ temporary: string; hash: string }> {
    const temporary = this.secrets.temporaryPassword();
    return { temporary, hash: await this.hasher.hash(temporary) };
  }

  matches(password: string, hash: string): Promise<boolean> {
    return this.hasher.verify(password, hash);
  }

  private async store(
    userId: string,
    passwordHash: string,
    mustChangePassword: boolean,
  ): Promise<void> {
    await this.credentials.update(userId, {
      passwordHash,
      mustChangePassword,
      passwordChangedAt: this.clock.now(),
      ...UNLOCKED,
    });
  }
}
