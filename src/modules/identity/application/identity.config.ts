import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { LockoutConfig } from "@/modules/identity/domain/lockout-policy";

// Tunables of the identity module, read once from the validated env.
@Injectable()
export class IdentityConfig {
  readonly lockout: LockoutConfig;
  readonly refreshTokenTtlDays: number;
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
  }
}
