import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { AUDIT_LOG_REPOSITORY } from "@/modules/audit/application/ports/audit-log-repository.port";
import { AuditLogOrmEntity } from "@/modules/audit/infrastructure/persistence/typeorm/entities/audit-log.orm-entity";
import { AuditLogTypeormRepository } from "@/modules/audit/infrastructure/persistence/typeorm/repositories/audit-log-typeorm.repository";
import { AuditResolver } from "@/modules/audit/presentation/graphql/audit.resolver";

// Append-only trail of administrative actions. Other modules record through
// AuditTrailService; reading requires AUDIT_READ.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogOrmEntity])],
  providers: [
    AuditTrailService,
    AuditResolver,
    { provide: AUDIT_LOG_REPOSITORY, useClass: AuditLogTypeormRepository },
  ],
  exports: [AuditTrailService],
})
export class AuditModule {}
