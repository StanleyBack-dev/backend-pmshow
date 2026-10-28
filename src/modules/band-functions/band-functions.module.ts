import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { BandFunctionsUseCase } from "@/modules/band-functions/application/band-functions.use-cases";
import { BAND_FUNCTION_REPOSITORY } from "@/modules/band-functions/application/ports/band-function-repository.port";
import { BandFunctionOrmEntity } from "@/modules/band-functions/infrastructure/persistence/typeorm/band-function.orm-entity";
import { BandFunctionTypeormRepository } from "@/modules/band-functions/infrastructure/persistence/typeorm/band-function-typeorm.repository";
import { BandFunctionsResolver } from "@/modules/band-functions/presentation/graphql/band-functions.resolver";

// Functions in the band (conductor, driver, sound technician…): a catalog of
// its own, used in member profiles and on rosters.
@Module({
  imports: [TypeOrmModule.forFeature([BandFunctionOrmEntity]), AuditModule],
  providers: [
    BandFunctionsUseCase,
    BandFunctionsResolver,
    {
      provide: BAND_FUNCTION_REPOSITORY,
      useClass: BandFunctionTypeormRepository,
    },
  ],
  exports: [BandFunctionsUseCase],
})
export class BandFunctionsModule {}
