import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { AbsencesUseCase } from "@/modules/availability/application/absences.use-cases";
import { ABSENCE_REPOSITORY } from "@/modules/availability/application/ports/absence-repository.port";
import {
  AbsenceAttachmentOrmEntity,
  AbsenceOrmEntity,
} from "@/modules/availability/infrastructure/persistence/typeorm/absence.orm-entity";
import { AbsenceTypeormRepository } from "@/modules/availability/infrastructure/persistence/typeorm/absence-typeorm.repository";
import { AvailabilityResolver } from "@/modules/availability/presentation/graphql/availability.resolver";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MediaModule } from "@/modules/media/media.module";
import { MembersModule } from "@/modules/members/members.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// Absences (vacation, leave, mission…). Approved ones block rosters, which
// read them through AbsencesUseCase.approvedDuring.
@Module({
  imports: [
    TypeOrmModule.forFeature([AbsenceOrmEntity, AbsenceAttachmentOrmEntity]),
    AccessControlModule,
    AuditModule,
    IdentityModule,
    MediaModule,
    MembersModule,
    OutboxModule,
  ],
  providers: [
    AbsencesUseCase,
    AvailabilityResolver,
    { provide: ABSENCE_REPOSITORY, useClass: AbsenceTypeormRepository },
  ],
  exports: [AbsencesUseCase],
})
export class AvailabilityModule {}
