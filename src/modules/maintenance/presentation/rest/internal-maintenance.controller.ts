import { Controller, Post } from "@nestjs/common";
import { InternalRoute } from "@/common/decorators/internal-route.decorator";
import {
  CleanupUseCase,
  type CleanupReport,
} from "@/modules/maintenance/application/cleanup.use-case";

// Called daily by the scheduled GitHub Actions workflow (CRON_SECRET).
@InternalRoute()
@Controller("internal/maintenance")
export class InternalMaintenanceController {
  constructor(private readonly cleanup: CleanupUseCase) {}

  @Post("cleanup")
  run(): Promise<CleanupReport> {
    return this.cleanup.run();
  }
}
