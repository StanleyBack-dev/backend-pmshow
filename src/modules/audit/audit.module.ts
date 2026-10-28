import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { RECORD_STAMP_REPOSITORY } from "@/modules/audit/application/ports/record-stamp-repository.port";
import { RecordStampTypeormRepository } from "@/modules/audit/infrastructure/persistence/record-stamp.repository";
import { AuditResolver } from "@/modules/audit/presentation/graphql/audit.resolver";

// Who created and who last changed each record, kept in the records' own
// tables. Other modules stamp through AuditTrailService; everyone signed in
// reads the stamp of what they can see (accounts and sign-ups: who manages
// users; band profiles: who reads members).
@Module({
  imports: [AccessControlModule],
  providers: [
    AuditTrailService,
    AuditResolver,
    {
      provide: RECORD_STAMP_REPOSITORY,
      useClass: RecordStampTypeormRepository,
    },
  ],
  exports: [AuditTrailService],
})
export class AuditModule {}
