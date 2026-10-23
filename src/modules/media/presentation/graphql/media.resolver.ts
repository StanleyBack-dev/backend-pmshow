import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import {
  MediaUseCase,
  type AudioUploadTicket,
} from "@/modules/media/application/media.use-cases";
import type { MediaAsset } from "@/modules/media/domain/media";
import {
  AddYoutubeVideoInput,
  AudioUploadTicketType,
  ConfirmAudioUploadInput,
  MediaAssetType,
  RequestAudioUploadInput,
} from "@/modules/media/presentation/graphql/media.graphql-types";
import type { Song } from "@/modules/repertoire/domain/song";
import { SongType } from "@/modules/repertoire/presentation/graphql/repertoire.graphql-types";

const Id = () => new ParseUUIDPipe({ version: "4" });

@Resolver()
export class MediaResolver {
  constructor(private readonly media: MediaUseCase) {}

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => String, {
    description:
      "Link temporário para tocar o áudio (válido por pelo menos 1 hora).",
  })
  audioPlaybackUrl(
    @Args("assetId", { type: () => ID }, Id()) assetId: string,
  ): Promise<string> {
    return this.media.playbackUrl(assetId);
  }

  @RequirePermissions(Permission.REPERTOIRE_READ, Permission.MEDIA_DOWNLOAD)
  @Query(() => String, {
    description: "Link temporário que baixa o arquivo de áudio.",
  })
  audioDownloadUrl(
    @Args("assetId", { type: () => ID }, Id()) assetId: string,
  ): Promise<string> {
    return this.media.downloadUrl(assetId);
  }

  @RequirePermissions(Permission.MEDIA_UPLOAD)
  @Mutation(() => MediaAssetType)
  addYoutubeVideo(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: AddYoutubeVideoInput,
  ): Promise<MediaAsset> {
    return this.media.addYoutubeVideo(
      actor,
      input.songId,
      input.link,
      input.title,
    );
  }

  @RequirePermissions(Permission.MEDIA_UPLOAD)
  @Mutation(() => AudioUploadTicketType, {
    description:
      "1º passo do envio de áudio: devolve o formulário assinado para o navegador enviar o arquivo direto ao armazenamento.",
  })
  requestAudioUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: RequestAudioUploadInput,
  ): Promise<AudioUploadTicket> {
    return this.media.requestAudioUpload(actor, input.songId, input);
  }

  @RequirePermissions(Permission.MEDIA_UPLOAD)
  @Mutation(() => MediaAssetType, {
    description: "2º passo: confere o arquivo no armazenamento e o publica.",
  })
  confirmAudioUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: ConfirmAudioUploadInput,
  ): Promise<MediaAsset> {
    return this.media.confirmAudioUpload(
      actor,
      input.assetId,
      input.durationSeconds ?? null,
    );
  }

  @RequirePermissions(Permission.MEDIA_UPLOAD)
  @Mutation(() => MediaAssetType)
  renameMedia(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("title") title: string,
  ): Promise<MediaAsset> {
    return this.media.rename(actor, id, title);
  }

  @RequirePermissions(Permission.MEDIA_UPLOAD)
  @Mutation(() => Boolean)
  async removeMedia(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<boolean> {
    await this.media.remove(actor, id);
    return true;
  }
}

// Adds `media` to the Song type from here, so the repertoire module stays
// unaware of media.
@Resolver(() => SongType)
export class SongMediaResolver {
  constructor(private readonly mediaUseCase: MediaUseCase) {}

  @ResolveField(() => [MediaAssetType], {
    description: "Áudios e vídeos prontos desta música.",
  })
  media(@Parent() song: Song): Promise<MediaAsset[]> {
    return this.mediaUseCase.listReady(song.id);
  }
}
