import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MembersModule } from "@/modules/members/members.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { SUPPORT_REPOSITORY } from "@/modules/support/application/ports/support-repository.port";
import { SupportUseCase } from "@/modules/support/application/support.use-cases";
import { SupportRequestOrmEntity } from "@/modules/support/infrastructure/persistence/typeorm/support-request.orm-entity";
import { SupportTypeormRepository } from "@/modules/support/infrastructure/persistence/typeorm/support-typeorm.repository";
import { SupportResolver } from "@/modules/support/presentation/graphql/support.resolver";

// The app's support (like Vaulto's): requests from anyone signed in, up to
// three a day, answered by the system's administrators. Notices go through
// the outbox like every other one.
@Module({
  imports: [
    TypeOrmModule.forFeature([SupportRequestOrmEntity]),
    AuditModule,
    IdentityModule,
    MembersModule,
    OutboxModule,
  ],
  providers: [
    SupportUseCase,
    SupportResolver,
    { provide: SUPPORT_REPOSITORY, useClass: SupportTypeormRepository },
  ],
})
export class SupportModule {}
