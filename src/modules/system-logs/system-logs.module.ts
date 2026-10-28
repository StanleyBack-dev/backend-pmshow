import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { SYSTEM_LOG_REPOSITORY } from "@/modules/system-logs/application/ports/system-log-repository.port";
import { SystemLogsService } from "@/modules/system-logs/application/system-logs.service";
import { SystemLogOrmEntity } from "@/modules/system-logs/infrastructure/system-log.orm-entity";
import { SystemLogRepository } from "@/modules/system-logs/infrastructure/system-log.repository";
import { InternalAlertsController } from "@/modules/system-logs/presentation/internal-alerts.controller";
import { SystemLogsPlugin } from "@/modules/system-logs/presentation/system-logs.plugin";
import { SystemLogsResolver } from "@/modules/system-logs/presentation/system-logs.resolver";

// The system log and the ADMIN_MASTER alerts (Administração → Logs).
@Module({
  imports: [
    TypeOrmModule.forFeature([SystemLogOrmEntity]),
    IdentityModule,
    OutboxModule,
  ],
  controllers: [InternalAlertsController],
  providers: [
    SystemLogsService,
    { provide: SYSTEM_LOG_REPOSITORY, useClass: SystemLogRepository },
    SystemLogsResolver,
    SystemLogsPlugin,
  ],
  exports: [SystemLogsService],
})
export class SystemLogsModule {}
