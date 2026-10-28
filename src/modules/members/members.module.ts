import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { BandFunctionsModule } from "@/modules/band-functions/band-functions.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { INSTRUMENT_REPOSITORY } from "@/modules/members/application/ports/instrument-repository.port";
import { MEMBER_REPOSITORY } from "@/modules/members/application/ports/member-repository.port";
import { InstrumentsUseCase } from "@/modules/members/application/use-cases/instruments.use-cases";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import {
  InstrumentOrmEntity,
  MemberFunctionOrmEntity,
  MemberInstrumentOrmEntity,
  MemberOrmEntity,
} from "@/modules/members/infrastructure/persistence/typeorm/entities/member.orm-entity";
import { InstrumentTypeormRepository } from "@/modules/members/infrastructure/persistence/typeorm/repositories/instrument-typeorm.repository";
import { MemberTypeormRepository } from "@/modules/members/infrastructure/persistence/typeorm/repositories/member-typeorm.repository";
import { MembersResolver } from "@/modules/members/presentation/graphql/members.resolver";

// The band side of a person: war name, rank, section, instruments and
// status. Identity owns the account; this module owns the profile.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MemberOrmEntity,
      InstrumentOrmEntity,
      MemberInstrumentOrmEntity,
      MemberFunctionOrmEntity,
    ]),
    IdentityModule,
    AuditModule,
    BandFunctionsModule,
  ],
  providers: [
    MembersUseCase,
    InstrumentsUseCase,
    MembersResolver,
    { provide: MEMBER_REPOSITORY, useClass: MemberTypeormRepository },
    { provide: INSTRUMENT_REPOSITORY, useClass: InstrumentTypeormRepository },
  ],
  exports: [MembersUseCase, InstrumentsUseCase],
})
export class MembersModule {}
