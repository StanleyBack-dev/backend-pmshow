import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { ArtistsUseCase } from "@/modules/artists/application/artists.use-cases";
import { ARTIST_REPOSITORY } from "@/modules/artists/application/ports/artist-repository.port";
import { ArtistOrmEntity } from "@/modules/artists/infrastructure/persistence/typeorm/artist.orm-entity";
import { ArtistTypeormRepository } from "@/modules/artists/infrastructure/persistence/typeorm/artist-typeorm.repository";
import { ArtistsResolver } from "@/modules/artists/presentation/graphql/artists.resolver";

// Singers, bands and composers of the repertoire. Songs point to them
// (repertoire depends on this module, never the other way around).
@Module({
  imports: [
    TypeOrmModule.forFeature([ArtistOrmEntity]),
    AccessControlModule,
    AuditModule,
  ],
  providers: [
    ArtistsUseCase,
    ArtistsResolver,
    { provide: ARTIST_REPOSITORY, useClass: ArtistTypeormRepository },
  ],
  exports: [ArtistsUseCase],
})
export class ArtistsModule {}
