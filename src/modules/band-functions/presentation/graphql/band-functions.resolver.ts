import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { BandFunctionsUseCase } from "@/modules/band-functions/application/band-functions.use-cases";
import type {
  BandFunction,
  BandFunctionListItem,
} from "@/modules/band-functions/domain/band-function";
import {
  BandFunctionFilterInput,
  BandFunctionPage,
  BandFunctionType,
  CreateBandFunctionInput,
  UpdateBandFunctionInput,
} from "@/modules/band-functions/presentation/graphql/band-functions.graphql-types";
import type { Paginated } from "@/shared/application/pagination";

const Id = () => new ParseUUIDPipe({ version: "4" });

// Only who manages the band (Gestor, Administrador geral) reads and edits
// the catalog. The list (no paging) feeds the roster editor, so it asks for
// the roster permission; names on a roster reach everyone else through it.
@Resolver()
export class BandFunctionsResolver {
  constructor(private readonly useCase: BandFunctionsUseCase) {}

  @RequirePermissions(Permission.ROSTERS_MANAGE)
  @Query(() => [BandFunctionType], {
    description: "Funções da banda, por nome.",
  })
  bandFunctions(
    @Args("includeArchived", { defaultValue: false }) includeArchived: boolean,
  ): Promise<BandFunction[]> {
    return this.useCase.list(includeArchived);
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Query(() => BandFunctionPage, {
    description: "Página do catálogo de funções: busca e arquivadas.",
  })
  bandFunctionsPage(
    @Args("filter", { nullable: true }) filter?: BandFunctionFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<BandFunctionListItem>> {
    return this.useCase.page(
      { search: filter?.search, archived: filter?.archived ?? false },
      page ?? { page: 1, limit: 10 },
    );
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Mutation(() => BandFunctionType)
  createBandFunction(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateBandFunctionInput,
  ): Promise<BandFunction> {
    return this.useCase.create(actor, input);
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Mutation(() => BandFunctionType)
  updateBandFunction(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: UpdateBandFunctionInput,
  ): Promise<BandFunction> {
    return this.useCase.update(actor, id, input);
  }
}
