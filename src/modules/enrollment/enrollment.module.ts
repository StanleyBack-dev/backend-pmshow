import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import {
  EnrollmentInvitesUseCase,
  EnrollmentReviewUseCase,
  PublicEnrollmentUseCase,
} from "@/modules/enrollment/application/enrollment.use-cases";
import { ENROLLMENT_REPOSITORY } from "@/modules/enrollment/application/ports/enrollment-repository.port";
import {
  EnrollmentInviteOrmEntity,
  EnrollmentRequestOrmEntity,
} from "@/modules/enrollment/infrastructure/persistence/typeorm/enrollment.orm-entity";
import { EnrollmentTypeormRepository } from "@/modules/enrollment/infrastructure/persistence/typeorm/enrollment-typeorm.repository";
import {
  EnrollmentAdminResolver,
  EnrollmentRequestFieldsResolver,
  PublicEnrollmentResolver,
} from "@/modules/enrollment/presentation/graphql/enrollment.resolver";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MediaModule } from "@/modules/media/media.module";
import { MembersModule } from "@/modules/members/members.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// Self-service sign-up through a public link: a cohort code opens the form,
// each answer waits for a manager (ADMIN_MASTER is notified through the
// outbox), and approving it creates the account (identity) and the band
// profile (members).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnrollmentInviteOrmEntity,
      EnrollmentRequestOrmEntity,
    ]),
    AccessControlModule,
    AuditModule,
    IdentityModule,
    MembersModule,
    MediaModule,
    OutboxModule,
  ],
  providers: [
    EnrollmentInvitesUseCase,
    PublicEnrollmentUseCase,
    EnrollmentReviewUseCase,
    PublicEnrollmentResolver,
    EnrollmentAdminResolver,
    EnrollmentRequestFieldsResolver,
    { provide: ENROLLMENT_REPOSITORY, useClass: EnrollmentTypeormRepository },
  ],
})
export class EnrollmentModule {}
