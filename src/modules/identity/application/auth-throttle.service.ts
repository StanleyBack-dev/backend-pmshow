import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { IdentityConfig } from "@/modules/identity/application/identity.config";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";
import { rateStatus, type RateRule } from "@/shared/domain/rate-limit";

type Action = "login-failure" | "recovery-request" | "recovery-verify";

// Per-IP limits on the public auth endpoints, on top of the per-account
// lockout: they stop one address from guessing passwords across many
// accounts or flooding recovery e-mails. The IP is stored only as an HMAC.
@Injectable()
export class AuthThrottleService {
  constructor(
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly config: IdentityConfig,
  ) {}

  /** Throws 429 when the address already used up its failed logins. */
  async assertCanTryLogin(ip: string | null): Promise<void> {
    const rule = this.config.ipLimits["login-failure"];
    const window = await this.limits.peek(
      this.key("login-failure", ip),
      rule.windowMs,
    );
    this.assert(window, rule);
  }

  /** Counts a failed login of this address. */
  async failedLogin(ip: string | null): Promise<void> {
    const rule = this.config.ipLimits["login-failure"];
    await this.limits.hit(this.key("login-failure", ip), rule.windowMs);
  }

  /** Counts the request, then throws 429 if it went over the limit. */
  async consume(
    action: Exclude<Action, "login-failure">,
    ip: string | null,
  ): Promise<void> {
    const rule = this.config.ipLimits[action];
    const window = await this.limits.hit(this.key(action, ip), rule.windowMs);
    // `hit` already counted this request: blocked only when it went over.
    this.assert({ ...window, count: window.count - 1 }, rule);
  }

  private assert(
    window: { count: number; resetAt: Date } | null,
    rule: RateRule,
  ): void {
    const status = rateStatus(window, rule, this.clock.now());
    if (status.blocked) {
      throw AppException.from(APP_ERRORS.identity.tooManyRequests, {
        minutes: status.retryAfterMinutes,
      });
    }
  }

  private key(action: Action, ip: string | null): string {
    return `auth:${action}:${this.secrets.digest(ip ?? "unknown")}`;
  }
}
