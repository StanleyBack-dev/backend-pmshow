import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { PlaylistsUseCase } from "@/modules/playlists/application/playlists.use-cases";
import { PLAYLIST_REPOSITORY } from "@/modules/playlists/application/ports/playlist-repository.port";
import {
  PlaylistItemOrmEntity,
  PlaylistOrmEntity,
} from "@/modules/playlists/infrastructure/persistence/typeorm/playlist.orm-entity";
import { PlaylistTypeormRepository } from "@/modules/playlists/infrastructure/persistence/typeorm/playlist-typeorm.repository";
import {
  PlaylistItemFieldsResolver,
  PlaylistsResolver,
} from "@/modules/playlists/presentation/graphql/playlists.resolver";
import { RepertoireModule } from "@/modules/repertoire/repertoire.module";

// Playlists of the repertoire (rehearsal mode): each person's own, and the
// ones shared with the band.
@Module({
  imports: [
    TypeOrmModule.forFeature([PlaylistOrmEntity, PlaylistItemOrmEntity]),
    AuditModule,
    RepertoireModule,
  ],
  providers: [
    PlaylistsUseCase,
    PlaylistsResolver,
    PlaylistItemFieldsResolver,
    { provide: PLAYLIST_REPOSITORY, useClass: PlaylistTypeormRepository },
  ],
})
export class PlaylistsModule {}
