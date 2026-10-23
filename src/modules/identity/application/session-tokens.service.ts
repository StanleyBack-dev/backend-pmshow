import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { IdentityConfig } from "@/modules/identity/application/identity.config";
import {
  ACCESS_TOKEN,
  type AccessTokenPort,
} from "@/modules/identity/application/ports/access-token.port";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import { composeRefreshToken } from "@/modules/identity/domain/refresh-token";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type IssuedTokens = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

@Injectable()
export class SessionTokensService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(ACCESS_TOKEN) private readonly accessTokens: AccessTokenPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly config: IdentityConfig,
  ) {}

  /** Opens a new session (one per login/device) and issues its tokens. */
  async open(userId: string, meta: RequestMeta): Promise<IssuedTokens> {
    const sessionId = randomUUID();
    const secret = this.secrets.randomToken();
    const expiresAt = this.refreshExpiry();

    await this.sessions.create({
      id: sessionId,
      userId,
      refreshSecretHash: this.secrets.digest(secret),
      expiresAt,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    });

    return this.issue(userId, sessionId, secret, expiresAt);
  }

  /** New access token for an existing session; slides its expiry. */
  async extend(
    userId: string,
    sessionId: string,
    secret: string,
  ): Promise<IssuedTokens> {
    const expiresAt = this.refreshExpiry();
    await this.sessions.touch(sessionId, expiresAt, this.clock.now());
    return this.issue(userId, sessionId, secret, expiresAt);
  }

  private issue(
    userId: string,
    sessionId: string,
    secret: string,
    refreshTokenExpiresAt: Date,
  ): IssuedTokens {
    const access = this.accessTokens.sign({ userId, sessionId });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: composeRefreshToken(sessionId, secret),
      refreshTokenExpiresAt,
    };
  }

  private refreshExpiry(): Date {
    return new Date(
      this.clock.now().getTime() + this.config.refreshTokenTtlDays * 86_400_000,
    );
  }
}
