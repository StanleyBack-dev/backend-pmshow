import { Module } from "@nestjs/common";
import { IdentityModule } from "@/modules/identity/identity.module";
import { CleanupUseCase } from "@/modules/maintenance/application/cleanup.use-case";
import { InternalMaintenanceController } from "@/modules/maintenance/presentation/rest/internal-maintenance.controller";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// Scheduled housekeeping (internal routes only, no GraphQL).
@Module({
  imports: [IdentityModule, NotificationsModule, OutboxModule],
  controllers: [InternalMaintenanceController],
  providers: [CleanupUseCase],
})
export class MaintenanceModule {}
