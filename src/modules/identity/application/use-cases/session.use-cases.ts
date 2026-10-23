import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  ACCESS_TOKEN,
  type AccessTokenPort,
} from "@/modules/identity/application/ports/access-token.port";
import {
  PRINCIPAL_READER,
  type Principal,
  type PrincipalReaderPort,
} from "@/modules/identity/application/ports/principal-reader.port";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import {
  SessionTokensService,
  type IssuedTokens,
} from "@/modules/identity/application/session-tokens.service";
import { parseRefreshToken } from "@/modules/identity/domain/refresh-token";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const isLive = (principal: Principal, now: Date) =>
  principal.sessionRevokedAt === null && principal.sessionExpiresAt > now;

/** Resolves the caller of every request (used by the session guard). */
@Injectable()
export class AuthenticateUseCase {
  constructor(
    @Inject(ACCESS_TOKEN) private readonly accessTokens: AccessTokenPort,
    @Inject(PRINCIPAL_READER) private readonly principals: PrincipalReaderPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    accessToken: string | null,
    ipAddress: string | null,
  ): Promise<AuthenticatedUser> {
    if (!accessToken) {
      throw AppException.from(APP_ERRORS.identity.sessionMissing, undefined);
    }
    const verified = this.accessTokens.verify(accessToken);
    if (verified.status === "expired") {
      throw AppException.from(APP_ERRORS.identity.tokenExpired, undefined);
    }
    if (verified.status === "invalid") {
      throw AppException.from(APP_ERRORS.identity.sessionMissing, undefined);
    }

    const { userId, sessionId } = verified.claims;
    const principal = await this.principals.findBySession(sessionId);
    if (
      !principal ||
      principal.userId !== userId ||
      !isLive(principal, this.clock.now())
    ) {
      throw AppException.from(APP_ERRORS.identity.sessionInvalid, undefined);
    }
    if (!principal.active) {
      throw AppException.from(APP_ERRORS.identity.userInactive, undefined);
    }

    return {
      id: principal.userId,
      sessionId: principal.sessionId,
      name: principal.name,
      username: principal.username,
      email: principal.email,
      group: principal.group,
      mustChangePassword: principal.mustChangePassword,
      ipAddress,
    };
  }
}

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(PRINCIPAL_READER) private readonly principals: PrincipalReaderPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly sessionTokens: SessionTokensService,
  ) {}

  async execute(refreshToken: string): Promise<IssuedTokens> {
    const parsed = parseRefreshToken(refreshToken);
    const session = parsed
      ? await this.sessions.findById(parsed.sessionId)
      : null;

    if (
      !parsed ||
      !session ||
      !this.secrets.sameDigest(
        this.secrets.digest(parsed.secret),
        session.refreshSecretHash,
      )
    ) {
      throw AppException.from(APP_ERRORS.identity.refreshInvalid, undefined);
    }

    const principal = await this.principals.findBySession(session.id);
    if (!principal || !isLive(principal, this.clock.now())) {
      throw AppException.from(APP_ERRORS.identity.refreshInvalid, undefined);
    }
    if (!principal.active) {
      throw AppException.from(APP_ERRORS.identity.userInactive, undefined);
    }

    return this.sessionTokens.extend(session.userId, session.id, parsed.secret);
  }
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, this.clock.now());
  }
}
