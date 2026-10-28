import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { InternalRoute } from "@/common/decorators/internal-route.decorator";
import { SystemLogsService } from "@/modules/system-logs/application/system-logs.service";

class RoutineFailureBody {
  @IsString()
  @MaxLength(120)
  workflow!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  job?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  runUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  branch?: string;
}

// Called by the GitHub Actions workflows when a run fails (CRON_SECRET), so
// the ADMIN_MASTER knows without watching the Actions tab.
@InternalRoute()
@Controller("internal/alerts")
export class InternalAlertsController {
  constructor(private readonly logs: SystemLogsService) {}

  @Post("routine-failed")
  @HttpCode(202)
  async routineFailed(@Body() body: RoutineFailureBody): Promise<{ ok: true }> {
    await this.logs.record({
      level: "CRITICAL",
      category: "ROUTINE",
      source: `GitHub Actions: ${body.workflow}`,
      message: `A execução falhou${body.job ? ` (${body.job})` : ""}${body.branch ? ` na branch ${body.branch}` : ""}.`,
      details: {
        workflow: body.workflow,
        job: body.job ?? null,
        runUrl: body.runUrl ?? null,
      },
      alert: true,
    });
    return { ok: true };
  }
}
