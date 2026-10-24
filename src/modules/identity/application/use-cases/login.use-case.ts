import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuthThrottleService } from "@/modules/identity/application/auth-throttle.service";
import { IdentityConfig } from "@/modules/identity/application/identity.config";
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
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import {
  SessionTokensService,
  type IssuedTokens,
  type RequestMeta,
} from "@/modules/identity/application/session-tokens.service";
import {
  afterFailedLogin,
  isLocked,
  UNLOCKED,
} from "@/modules/identity/domain/lockout-policy";
import type { User } from "@/modules/identity/domain/user";
import {
  isEmailLogin,
  normalizeEmail,
  normalizeUsername,
} from "@/modules/identity/domain/username";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type LoginResult = IssuedTokens & {
  user: User;
  mustChangePassword: boolean;
};

@Injectable()
export class LoginUseCase {
  // Hash checked when the login is unknown, so the response time doesn't
  // reveal whether a username exists.
  private decoyHash: Promise<string> | null = null;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly sessionTokens: SessionTokensService,
    private readonly config: IdentityConfig,
    private readonly throttle: AuthThrottleService,
  ) {}

  async execute(
    input: { login: string; password: string },
    meta: RequestMeta,
  ): Promise<LoginResult> {
    await this.throttle.assertCanTryLogin(meta.ipAddress);
    const login = isEmailLogin(input.login)
      ? normalizeEmail(input.login)
      : normalizeUsername(input.login);
    const user = await this.users.findByLogin(login);
    const credential = user
      ? await this.credentials.findByUserId(user.id)
      : null;

    if (!user || !credential) {
      await this.hasher.verify(input.password, await this.getDecoyHash());
      await this.throttle.failedLogin(meta.ipAddress);
      throw AppException.from(
        APP_ERRORS.identity.invalidCredentials,
        undefined,
      );
    }

    const now = this.clock.now();
    if (isLocked(credential, now)) {
      throw this.lockedError(credential.lockedUntil as Date, now);
    }

    if (!(await this.hasher.verify(input.password, credential.passwordHash))) {
      await this.throttle.failedLogin(meta.ipAddress);
      const next = afterFailedLogin(credential, now, this.config.lockout);
      await this.credentials.update(user.id, next);
      if (next.lockedUntil) throw this.lockedError(next.lockedUntil, now);
      throw AppException.from(
        APP_ERRORS.identity.invalidCredentials,
        undefined,
      );
    }

    // Only after the right password: an inactive account is not revealed to
    // someone guessing.
    if (!user.active) {
      throw AppException.from(APP_ERRORS.identity.userInactive, undefined);
    }

    if (credential.failedLoginAttempts > 0 || credential.lockedUntil) {
      await this.credentials.update(user.id, UNLOCKED);
    }
    await this.users.touchLastLogin(user.id, now);

    const tokens = await this.sessionTokens.open(user.id, meta);
    return {
      ...tokens,
      user,
      mustChangePassword: credential.mustChangePassword,
    };
  }

  private lockedError(lockedUntil: Date, now: Date): AppException {
    const minutes = Math.max(
      1,
      Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000),
    );
    return AppException.from(APP_ERRORS.identity.accountLocked, { minutes });
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.hasher.hash(this.secrets.randomToken());
    return this.decoyHash;
  }
}
