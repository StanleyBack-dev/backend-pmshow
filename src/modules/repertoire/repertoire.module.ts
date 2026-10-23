import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { SONG_REPOSITORY } from "@/modules/repertoire/application/ports/song-repository.port";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import { SongOrmEntity } from "@/modules/repertoire/infrastructure/persistence/typeorm/entities/song.orm-entity";
import { SongTypeormRepository } from "@/modules/repertoire/infrastructure/persistence/typeorm/repositories/song-typeorm.repository";
import { SongsResolver } from "@/modules/repertoire/presentation/graphql/songs.resolver";

// The band's songs and their metadata. Media (audio, video) attaches to songs
// from its own module through SongsUseCase.
@Module({
  imports: [
    TypeOrmModule.forFeature([SongOrmEntity]),
    AccessControlModule,
    AuditModule,
  ],
  providers: [
    SongsUseCase,
    SongsResolver,
    { provide: SONG_REPOSITORY, useClass: SongTypeormRepository },
  ],
  exports: [SongsUseCase],
})
export class RepertoireModule {}
