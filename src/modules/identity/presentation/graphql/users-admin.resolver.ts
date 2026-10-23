import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { ParseUUIDPipe } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import type { PermissionMatrix } from "@/modules/access-control/domain/permission-policy";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { PermissionMatrixType } from "@/modules/access-control/presentation/graphql/access-control.graphql-types";
import type { UserAccount } from "@/modules/identity/application/ports/user-repository.port";
import {
  ManageUsersUseCase,
  UserDirectoryUseCase,
  UserPermissionsUseCase,
  type TemporaryAccess,
} from "@/modules/identity/application/use-cases/manage-users.use-cases";
import {
  CreateUserInput,
  SetUserPermissionsInput,
  TemporaryAccessType,
  UpdateUserInput,
  UserAccountPage,
  UserAccountType,
  UserFilterInput,
} from "@/modules/identity/presentation/graphql/identity.graphql-types";
import type { Paginated } from "@/shared/application/pagination";

const UserId = () => new ParseUUIDPipe({ version: "4" });

@Resolver()
export class UsersAdminResolver {
  constructor(
    private readonly directory: UserDirectoryUseCase,
    private readonly manage: ManageUsersUseCase,
    private readonly permissionsUseCase: UserPermissionsUseCase,
  ) {}

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => UserAccountPage)
  users(
    @Args("filter", { nullable: true }) filter?: UserFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<UserAccount>> {
    return this.directory.list(filter ?? {}, page ?? { page: 1, limit: 20 });
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => UserAccountType)
  user(@Args("id", { type: () => ID }, UserId()) id: string) {
    return this.directory.get(id);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => TemporaryAccessType, {
    description: "Cria o usuário com senha temporária (enviada por e-mail).",
  })
  createUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateUserInput,
  ): Promise<TemporaryAccess> {
    return this.manage.create(actor, input);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => UserAccountType)
  updateUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UserId()) id: string,
    @Args("input") input: UpdateUserInput,
  ): Promise<UserAccount> {
    return this.manage.update(actor, id, input);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => UserAccountType, {
    description: "Ativa ou desativa o acesso. Desativar encerra as sessões.",
  })
  setUserActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UserId()) id: string,
    @Args("active") active: boolean,
  ): Promise<UserAccount> {
    return this.manage.setActive(actor, id, active);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => TemporaryAccessType, {
    description: "Gera nova senha temporária e encerra as sessões do usuário.",
  })
  resetUserPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UserId()) id: string,
  ): Promise<TemporaryAccess> {
    return this.manage.resetPassword(actor, id);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => UserAccountType)
  unlockUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UserId()) id: string,
  ): Promise<UserAccount> {
    return this.manage.unlock(actor, id);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => UserAccountType)
  revokeUserSessions(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UserId()) id: string,
  ): Promise<UserAccount> {
    return this.manage.revokeSessions(actor, id);
  }

  @RequirePermissions(Permission.PERMISSIONS_MANAGE)
  @Query(() => PermissionMatrixType)
  userPermissions(
    @Args("id", { type: () => ID }, UserId()) id: string,
  ): Promise<PermissionMatrix> {
    return this.permissionsUseCase.get(id);
  }

  @RequirePermissions(Permission.PERMISSIONS_MANAGE)
  @Mutation(() => PermissionMatrixType)
  setUserPermissions(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: SetUserPermissionsInput,
  ): Promise<PermissionMatrix> {
    return this.permissionsUseCase.set(
      actor,
      input.userId,
      input.useGroupDefaults ? null : (input.permissions ?? []),
    );
  }
}
