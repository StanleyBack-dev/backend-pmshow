import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "@nestjs/graphql";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PageInput, Paginated } from "@/common/graphql/pagination.graphql";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { ArtistsUseCase } from "@/modules/artists/application/artists.use-cases";
import type { Artist, ArtistListItem } from "@/modules/artists/domain/artist";
import type { Paginated as PaginatedResult } from "@/shared/application/pagination";

@ObjectType("Artist", { description: "Cantor, banda ou artista." })
export class ArtistType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  archived!: boolean;

  @Field()
  createdAt!: Date;
}

@ObjectType("ArtistListItem", {
  description: "Linha da página de cantores e bandas.",
})
class ArtistListItemType extends ArtistType {
  @Field(() => Int, { description: "Músicas no repertório (não arquivadas)." })
  songCount!: number;
}

const ArtistPage = Paginated(ArtistListItemType, "ArtistPage");

@InputType()
class ArtistFilterInput {
  @Field({ nullable: true, description: "Parte do nome (sem acento)." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @Field({ nullable: true, description: "Arquivados (só gestão)." })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @Field({
    nullable: true,
    description: "true: só com músicas; false: só sem músicas.",
  })
  @IsOptional()
  @IsBoolean()
  withSongs?: boolean;
}

@InputType()
class ArtistInput {
  @Field()
  @IsString()
  @Length(2, 120)
  name!: string;

  @Field({ nullable: true, description: "Só na edição." })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

const Id = () => new ParseUUIDPipe({ version: "4" });

@Resolver(() => ArtistType)
export class ArtistsResolver {
  constructor(
    private readonly artistsUseCase: ArtistsUseCase,
    private readonly permissions: PermissionsService,
  ) {}

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => ArtistPage, {
    description: "Página de cantores e bandas, com filtros.",
  })
  async artistsPage(
    @CurrentUser() user: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: ArtistFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<ArtistListItem>> {
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
    return this.artistsUseCase.page(
      { search: filter?.search, withSongs: filter?.withSongs, archived },
      page ?? { page: 1, limit: 20 },
    );
  }

  @RequirePermissions(Permission.REPERTOIRE_READ)
  @Query(() => [ArtistType], { description: "Em ordem alfabética." })
  artists(
    @Args("includeArchived", { defaultValue: false }) includeArchived: boolean,
  ): Promise<Artist[]> {
    return this.artistsUseCase.list(includeArchived);
  }

  @RequirePermissions(Permission.REPERTOIRE_MANAGE)
  @Mutation(() => ArtistType)
  createArtist(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: ArtistInput,
  ): Promise<Artist> {
    return this.artistsUseCase.create(actor, input.name);
  }

  @RequirePermissions(Permission.REPERTOIRE_MANAGE)
  @Mutation(() => ArtistType)
  updateArtist(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: ArtistInput,
  ): Promise<Artist> {
    return this.artistsUseCase.update(actor, id, input);
  }
}
