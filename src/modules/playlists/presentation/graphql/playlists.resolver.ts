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
import {
  ArrayMaxSize,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { requestLoader } from "@/common/graphql/request-loader";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { PlaylistsUseCase } from "@/modules/playlists/application/playlists.use-cases";
import type { PlaylistView } from "@/modules/playlists/application/ports/playlist-repository.port";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import type { Song } from "@/modules/repertoire/domain/song";
import { SongType } from "@/modules/repertoire/presentation/graphql/repertoire.graphql-types";

const Id = () => new ParseUUIDPipe({ version: "4" });

@ObjectType("PlaylistSong", { description: "Música da playlist, na ordem." })
class PlaylistSongType {
  @Field(() => Int)
  position!: number;

  @Field(() => ID)
  songId!: string;
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

  @Field(() => Int)
  songCount!: number;

  @Field(() => [PlaylistSongType])
  songs!: PlaylistSongType[];

  @Field()
  updatedAt!: Date;
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

  @Field(() => [ID], { description: "Músicas na ordem em que tocam." })
  @ArrayMaxSize(400)
  @IsUUID("4", { each: true })
  songIds!: string[];
}

const toType = (playlist: PlaylistView): PlaylistType => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description,
  shared: playlist.shared,
  ownerId: playlist.ownerId,
  ownerName: playlist.ownerName,
  songCount: playlist.songIds.length,
  songs: playlist.songIds.map((songId, index) => ({
    position: index + 1,
    songId,
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
    return toType(await this.useCase.create(user, input));
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Mutation(() => PlaylistType, { description: "Só quem criou altera." })
  async updatePlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: PlaylistInput,
  ): Promise<PlaylistType> {
    return toType(await this.useCase.update(user, id, input));
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

// The song of each line (one query per request for the whole list).
@Resolver(() => PlaylistSongType)
export class PlaylistSongFieldsResolver {
  constructor(private readonly songs: SongsUseCase) {}

  @ResolveField(() => SongType, {
    nullable: true,
    description: "null se a música foi apagada.",
  })
  song(
    @Parent() line: PlaylistSongType,
    @Context() context: object,
  ): Promise<Song | null> {
    return requestLoader(context, "songs", async (ids) => {
      const songs = await this.songs.findMany(ids);
      return new Map(songs.map((song) => [song.id, song]));
    }).load(line.songId);
  }
}
