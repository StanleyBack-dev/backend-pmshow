import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { LockoutConfig } from "@/modules/identity/domain/lockout-policy";
import type { RateRule } from "@/shared/domain/rate-limit";

// Tunables of the identity module, read once from the validated env.
@Injectable()
export class IdentityConfig {
  readonly lockout: LockoutConfig;
  readonly refreshTokenTtlDays: number;
  /** Per-IP limits on the public auth endpoints. */
  readonly ipLimits: Record<
    "login-failure" | "recovery-request" | "recovery-verify",
    RateRule
  >;
  readonly recovery = {
    codeDigits: 6,
    codeTtlMinutes: 15,
    maxAttempts: 5,
    maxCodesPerHour: 3,
    resetTokenTtlMinutes: 15,
  } as const;

  constructor(config: ConfigService) {
    this.lockout = {
      maxAttempts: config.get<number>("AUTH_MAX_FAILED_ATTEMPTS") ?? 5,
      lockMinutes: config.get<number>("AUTH_LOCK_MINUTES") ?? 15,
    };
    this.refreshTokenTtlDays =
      config.get<number>("REFRESH_TOKEN_TTL_DAYS") ?? 30;
    const minutes = (value: number) => value * 60_000;
    this.ipLimits = {
      "login-failure": {
        limit: config.get<number>("AUTH_IP_LOGIN_FAILURES") ?? 20,
        windowMs: minutes(15),
      },
      "recovery-request": {
        limit: config.get<number>("AUTH_IP_RECOVERY_REQUESTS") ?? 10,
        windowMs: minutes(60),
      },
      "recovery-verify": {
        limit: config.get<number>("AUTH_IP_RECOVERY_VERIFY") ?? 20,
        windowMs: minutes(15),
      },
    };
  }
}
