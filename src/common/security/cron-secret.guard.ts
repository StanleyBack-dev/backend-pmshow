import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { safeCompare } from "@/common/security/safe-compare";

// The scheduled GitHub Actions workflows authenticate with
// `Authorization: Bearer $CRON_SECRET`. When the secret is unset, every
// request is rejected.
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>("CRON_SECRET");
    const authorization =
      context.switchToHttp().getRequest<Request>().header("authorization") ??
      "";

    if (!secret || !safeCompare(authorization, `Bearer ${secret}`)) {
      throw AppException.from(APP_ERRORS.auth.invalidCronSecret, undefined);
    }
    return true;
  }
}
