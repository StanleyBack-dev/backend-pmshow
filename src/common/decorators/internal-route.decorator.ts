import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import { CronSecretGuard } from "@/common/security/cron-secret.guard";

// REST routes called by the scheduled GitHub Actions workflows. They skip
// both the BFF key and the user session: CRON_SECRET is the credential here.
export const IS_INTERNAL_ROUTE_KEY = "isInternalRoute";

export const InternalRoute = () =>
  applyDecorators(
    SetMetadata(IS_INTERNAL_ROUTE_KEY, true),
    UseGuards(CronSecretGuard),
  );
