import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { requestLoader } from "@/common/graphql/request-loader";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { ArtistsUseCase } from "@/modules/artists/application/artists.use-cases";
import type { Artist } from "@/modules/artists/domain/artist";
import { ArtistType } from "@/modules/artists/presentation/graphql/artists.resolver";
import { LyricsLookupUseCase } from "@/modules/repertoire/application/lyrics-lookup.use-case";
import type { LyricsResult } from "@/modules/repertoire/application/ports/lyrics.port";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import type { Song } from "@/modules/repertoire/domain/song";
import {
  LyricsResultType,
  SongFilterInput,
  SongInput,
  SongPage,
  SongType,
} from "@/modules/repertoire/presentation/graphql/repertoire.graphql-types";
import type { Paginated } from "@/shared/application/pagination";

const Id = () => new ParseUUIDPipe({ version: "4" });

@Resolver(() => SongType)
export class SongsResolver {
  constructor(
    private readonly songsUseCase: SongsUseCase,
    private readonly permissions: PermissionsService,
    private readonly artistsUseCase: ArtistsUseCase,
    private readonly lyricsLookup: LyricsLookupUseCase,
  ) {}

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => SongPage)
  async songs(
    @CurrentUser() user: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: SongFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<Song>> {
    const archived = filter?.archived ?? false;
    // The archive is a management view.
    if (
      archived &&
      !(await this.permissions.effectiveFor(user)).has(
        Permission.REPERTOIRE_MANAGE,
      )
    ) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
      );
    }
    return this.songsUseCase.list(
      { ...filter, archived },
      page ?? { page: 1, limit: 20 },
    );
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => SongType)
  song(@Args("id", { type: () => ID }, Id()) id: string): Promise<Song> {
    return this.songsUseCase.get(id);
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => [String], { description: "Tags em uso no repertório." })
  songTags(): Promise<string[]> {
    return this.songsUseCase.listTags();
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => [String], { description: "Títulos, para o filtro." })
  async songTitles(
    @CurrentUser() user: AuthenticatedUser,
    @Args("archived", { defaultValue: false }) archived: boolean,
  ): Promise<string[]> {
    if (
      archived &&
      !(await this.permissions.effectiveFor(user)).has(
        Permission.REPERTOIRE_MANAGE,
      )
    ) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
      );
    }
    return this.songsUseCase.listTitles(archived);
  }

  @RequirePermissions(Permission.REPERTOIRE_MANAGE)
  @Query(() => LyricsResultType, {
    nullable: true,
    description: "Letra completa num catálogo (null = não encontrada).",
  })
  findLyrics(
    @Args("artist") artist: string,
    @Args("title") title: string,
  ): Promise<LyricsResult | null> {
    return this.lyricsLookup.find(artist.slice(0, 120), title.slice(0, 160));
  }

  @ResolveField(() => ArtistType, { nullable: true })
  artist(
    @Parent() song: Song,
    @Context() context: object,
  ): Promise<Artist | null> | null {
    if (!song.artistId) return null;
    return requestLoader(context, "artists", async (ids) => {
      const artists = await this.artistsUseCase.findMany(ids);
      return new Map(artists.map((artist) => [artist.id, artist]));
    }).load(song.artistId);
  }

  @RequirePermissions(Permission.REPERTOIRE_MANAGE)
  @Mutation(() => SongType)
  createSong(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: SongInput,
  ): Promise<Song> {
    return this.songsUseCase.create(actor, input);
  }

  @RequirePermissions(Permission.REPERTOIRE_MANAGE)
  @Mutation(() => SongType)
  updateSong(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: SongInput,
  ): Promise<Song> {
    return this.songsUseCase.update(actor, id, input);
  }

  @RequirePermissions(Permission.REPERTOIRE_MANAGE)
  @Mutation(() => SongType, {
    description: "Arquiva (some das listas) ou restaura a música.",
  })
  setSongArchived(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("archived") archived: boolean,
  ): Promise<Song> {
    return this.songsUseCase.setArchived(actor, id, archived);
  }
}
