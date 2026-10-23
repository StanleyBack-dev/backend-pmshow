import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CronSecretGuard } from "@/common/security/cron-secret.guard";
import { AuditModule } from "@/modules/audit/audit.module";
import { MediaUseCase } from "@/modules/media/application/media.use-cases";
import {
  MEDIA_ASSET_REPOSITORY,
  OBJECT_STORAGE,
  YOUTUBE_METADATA,
} from "@/modules/media/application/ports/media.ports";
import { MediaAssetTypeormRepository } from "@/modules/media/infrastructure/persistence/typeorm/media-asset-typeorm.repository";
import { MediaAssetOrmEntity } from "@/modules/media/infrastructure/persistence/typeorm/media-asset.orm-entity";
import { NeonObjectStorageAdapter } from "@/modules/media/infrastructure/storage/neon-object-storage.adapter";
import { YoutubeOEmbedAdapter } from "@/modules/media/infrastructure/youtube/youtube-oembed.adapter";
import {
  MediaResolver,
  SongMediaResolver,
} from "@/modules/media/presentation/graphql/media.resolver";
import { InternalMediaController } from "@/modules/media/presentation/rest/internal-media.controller";
import { RepertoireModule } from "@/modules/repertoire/repertoire.module";

// Audio files (Neon Object Storage, uploaded by the browser straight to the
// bucket) and YouTube videos attached to songs.
@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAssetOrmEntity]),
    RepertoireModule,
    AuditModule,
  ],
  controllers: [InternalMediaController],
  providers: [
    MediaUseCase,
    MediaResolver,
    SongMediaResolver,
    CronSecretGuard,
    { provide: MEDIA_ASSET_REPOSITORY, useClass: MediaAssetTypeormRepository },
    { provide: OBJECT_STORAGE, useClass: NeonObjectStorageAdapter },
    { provide: YOUTUBE_METADATA, useClass: YoutubeOEmbedAdapter },
  ],
})
export class MediaModule {}
