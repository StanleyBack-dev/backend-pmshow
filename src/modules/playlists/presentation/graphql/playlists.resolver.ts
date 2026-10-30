import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  Context,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { requestLoader } from "@/common/graphql/request-loader";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { PlaylistsUseCase } from "@/modules/playlists/application/playlists.use-cases";
import type { PlaylistView } from "@/modules/playlists/application/ports/playlist-repository.port";
import type {
  PlaylistDraft,
  PlaylistItem,
} from "@/modules/playlists/domain/playlist";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import type { Song } from "@/modules/repertoire/domain/song";
import { SongType } from "@/modules/repertoire/presentation/graphql/repertoire.graphql-types";

const Id = () => new ParseUUIDPipe({ version: "4" });

@ObjectType("PlaylistVideo", {
  description:
    "Vídeo do YouTube guardado só na playlist (não é música do repertório).",
})
class PlaylistVideoType {
  @Field()
  videoId!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  channelTitle!: string | null;
}

@ObjectType("PlaylistItem", {
  description:
    "Item da playlist, na ordem: uma música do repertório ou um vídeo.",
})
class PlaylistItemType {
  @Field(() => Int)
  position!: number;

  @Field(() => ID, { nullable: true, description: "Música do repertório." })
  songId!: string | null;

  @Field(() => PlaylistVideoType, { nullable: true })
  video!: PlaylistVideoType | null;
}

@ObjectType("Playlist", {
  description: "Lista de músicas para ensaiar (tocadas em sequência).",
})
class PlaylistType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field({ description: "Visível (só para tocar) para toda a banda." })
  shared!: boolean;

  @Field(() => ID)
  ownerId!: string;

  @Field()
  ownerName!: string;

  @Field(() => Int, { description: "Músicas e vídeos." })
  itemCount!: number;

  @Field(() => [PlaylistItemType])
  items!: PlaylistItemType[];

  @Field()
  updatedAt!: Date;
}

@InputType()
class PlaylistVideoInput {
  @Field()
  @IsString()
  @MaxLength(20)
  videoId!: string;

  @Field()
  @IsString()
  @MaxLength(400)
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  channelTitle?: string | null;
}

@InputType({ description: "Uma música do repertório ou um vídeo." })
class PlaylistItemInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID("4")
  songId?: string | null;

  @Field(() => PlaylistVideoInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlaylistVideoInput)
  video?: PlaylistVideoInput | null;
}

@InputType()
class PlaylistInput {
  @Field()
  @IsString()
  @MaxLength(200)
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string | null;

  @Field()
  @IsBoolean()
  shared!: boolean;

  @Field(() => [PlaylistItemInput], { description: "Na ordem em que tocam." })
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => PlaylistItemInput)
  items!: PlaylistItemInput[];
}

/** Each line is either a song or a video, never both or neither. */
function toDraft(input: PlaylistInput): PlaylistDraft {
  const items = input.items.map((item): PlaylistItem | null => {
    if (item.songId && !item.video) {
      return { kind: "song", songId: item.songId };
    }
    if (item.video && !item.songId) {
      return {
        kind: "video",
        video: {
          videoId: item.video.videoId,
          title: item.video.title,
          channelTitle: item.video.channelTitle ?? null,
        },
      };
    }
    return null;
  });
  if (items.some((item) => item === null)) {
    throw AppException.from(APP_ERRORS.playlists.invalid, {
      reason: "Cada item da playlist é uma música ou um vídeo.",
    });
  }
  return {
    name: input.name,
    description: input.description,
    shared: input.shared,
    items: items.filter((item): item is PlaylistItem => item !== null),
  };
}

const toType = (playlist: PlaylistView): PlaylistType => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description,
  shared: playlist.shared,
  ownerId: playlist.ownerId,
  ownerName: playlist.ownerName,
  itemCount: playlist.items.length,
  items: playlist.items.map((item, index) => ({
    position: index + 1,
    songId: item.kind === "song" ? item.songId : null,
    video: item.kind === "video" ? item.video : null,
  })),
  updatedAt: playlist.updatedAt,
});

@Resolver()
export class PlaylistsResolver {
  constructor(private readonly useCase: PlaylistsUseCase) {}

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => [PlaylistType], {
    description: "Minhas playlists e as compartilhadas com a banda.",
  })
  async playlists(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlaylistType[]> {
    return (await this.useCase.list(user)).map(toType);
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => PlaylistType)
  async playlist(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<PlaylistType> {
    return toType(await this.useCase.get(user, id));
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Mutation(() => PlaylistType)
  async createPlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input") input: PlaylistInput,
  ): Promise<PlaylistType> {
    return toType(await this.useCase.create(user, toDraft(input)));
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Mutation(() => PlaylistType, { description: "Só quem criou altera." })
  async updatePlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: PlaylistInput,
  ): Promise<PlaylistType> {
    return toType(await this.useCase.update(user, id, toDraft(input)));
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Mutation(() => Boolean, { description: "Só quem criou apaga." })
  async deletePlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<boolean> {
    await this.useCase.remove(user, id);
    return true;
  }
}

// The song of each song line (one query per request for the whole list).
@Resolver(() => PlaylistItemType)
export class PlaylistItemFieldsResolver {
  constructor(private readonly songs: SongsUseCase) {}

  @ResolveField(() => SongType, {
    nullable: true,
    description: "Música do repertório; null nos vídeos.",
  })
  async song(
    @Parent() line: PlaylistItemType,
    @Context() context: object,
  ): Promise<Song | null> {
    if (!line.songId) return null;
    return requestLoader(context, "songs", async (ids) => {
      const songs = await this.songs.findMany(ids);
      return new Map(songs.map((song) => [song.id, song]));
    }).load(line.songId);
  }
}
