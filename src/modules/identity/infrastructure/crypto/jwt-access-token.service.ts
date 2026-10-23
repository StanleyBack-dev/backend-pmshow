import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  JsonWebTokenError,
  sign,
  TokenExpiredError,
  verify,
  type JwtPayload,
  type SignOptions,
} from "jsonwebtoken";
import type {
  AccessTokenClaims,
  AccessTokenPort,
  VerifiedAccessToken,
} from "@/modules/identity/application/ports/access-token.port";

const ISSUER = "pmshow-api";
const AUDIENCE = "pmshow-bff";

// Short-lived access token. It carries only who and which session: group and
// permissions are read fresh on every request, never trusted from the token.
@Injectable()
export class JwtAccessTokenService implements AccessTokenPort {
  private readonly secret: string;
  private readonly expiresIn: SignOptions["expiresIn"];

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>("JWT_ACCESS_SECRET");
    this.expiresIn = (config.get<string>("JWT_ACCESS_EXPIRES_IN") ??
      "15m") as SignOptions["expiresIn"];
  }

  sign(claims: AccessTokenClaims): { token: string; expiresAt: Date } {
    const token = sign({ sid: claims.sessionId }, this.secret, {
      algorithm: "HS256",
      subject: claims.userId,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: this.expiresIn,
    });
    const { exp } = verify(token, this.secret) as JwtPayload;
    return { token, expiresAt: new Date((exp as number) * 1000) };
  }

  verify(token: string): VerifiedAccessToken {
    try {
      const payload = verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as JwtPayload;
      if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
        return { status: "invalid" };
      }
      return {
        status: "valid",
        claims: { userId: payload.sub, sessionId: payload.sid as string },
      };
    } catch (error) {
      if (error instanceof TokenExpiredError) return { status: "expired" };
      if (error instanceof JsonWebTokenError) return { status: "invalid" };
      throw error;
    }
  }
}
