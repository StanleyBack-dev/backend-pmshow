import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { ArtistsModule } from "@/modules/artists/artists.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { LyricsLookupUseCase } from "@/modules/repertoire/application/lyrics-lookup.use-case";
import { LYRICS_PROVIDER } from "@/modules/repertoire/application/ports/lyrics.port";
import { SONG_REPOSITORY } from "@/modules/repertoire/application/ports/song-repository.port";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import { SongOrmEntity } from "@/modules/repertoire/infrastructure/persistence/typeorm/entities/song.orm-entity";
import { FallbackLyricsProvider } from "@/modules/repertoire/infrastructure/lyrics/fallback-lyrics.provider";
import { LrclibLyricsAdapter } from "@/modules/repertoire/infrastructure/lyrics/lrclib-lyrics.adapter";
import { LyricsOvhAdapter } from "@/modules/repertoire/infrastructure/lyrics/lyrics-ovh.adapter";
import { VagalumeLyricsAdapter } from "@/modules/repertoire/infrastructure/lyrics/vagalume-lyrics.adapter";
import { SongTypeormRepository } from "@/modules/repertoire/infrastructure/persistence/typeorm/repositories/song-typeorm.repository";
import { SongsResolver } from "@/modules/repertoire/presentation/graphql/songs.resolver";

// The band's songs and their metadata. Media (audio, video) attaches to songs
// from its own module through SongsUseCase.
@Module({
  imports: [
    TypeOrmModule.forFeature([SongOrmEntity]),
    AccessControlModule,
    ArtistsModule,
    AuditModule,
  ],
  providers: [
    SongsUseCase,
    LyricsLookupUseCase,
    SongsResolver,
    { provide: SONG_REPOSITORY, useClass: SongTypeormRepository },
    LrclibLyricsAdapter,
    LyricsOvhAdapter,
    VagalumeLyricsAdapter,
    {
      // Keyless catalogs first; Vagalume only when it has a key.
      provide: LYRICS_PROVIDER,
      useFactory: (
        lrclib: LrclibLyricsAdapter,
        lyricsOvh: LyricsOvhAdapter,
        vagalume: VagalumeLyricsAdapter,
      ) => new FallbackLyricsProvider([lrclib, lyricsOvh, vagalume]),
      inject: [LrclibLyricsAdapter, LyricsOvhAdapter, VagalumeLyricsAdapter],
    },
  ],
  exports: [SongsUseCase],
})
export class RepertoireModule {}
