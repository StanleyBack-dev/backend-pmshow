import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import type { Song } from "@/modules/repertoire/domain/song";
import {
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
