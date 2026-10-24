import { Inject, Injectable } from "@nestjs/common";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import {
  VERIFICATION_CODE_REPOSITORY,
  type VerificationCodeRepositoryPort,
} from "@/modules/identity/application/ports/verification-code-repository.port";

const DAY_MS = 86_400_000;
/** Ended sessions keep IP and browser a while for support, then go. */
const SESSION_RETENTION_DAYS = 30;
const CODE_RETENTION_DAYS = 7;

// Identity's share of the daily cleanup (LGPD: keep personal data no longer
// than needed). Called by the maintenance module.
@Injectable()
export class IdentityMaintenanceService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(VERIFICATION_CODE_REPOSITORY)
    private readonly codes: VerificationCodeRepositoryPort,
  ) {}

  async purge(now: Date): Promise<{ sessions: number; codes: number }> {
    const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const [sessions, codes] = await Promise.all([
      this.sessions.purgeEndedBefore(ago(SESSION_RETENTION_DAYS)),
      this.codes.purgeExpiredBefore(ago(CODE_RETENTION_DAYS)),
    ]);
    return { sessions, codes };
  }
}
