import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AllowFirstAccess } from "@/common/decorators/allow-first-access.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { LoginUseCase } from "@/modules/identity/application/use-cases/login.use-case";
import {
  ChangeOwnPasswordUseCase,
  UpdateOwnProfileUseCase,
} from "@/modules/identity/application/use-cases/own-account.use-cases";
import { PasswordRecoveryUseCase } from "@/modules/identity/application/use-cases/password-recovery.use-case";
import {
  LogoutUseCase,
  RefreshSessionUseCase,
} from "@/modules/identity/application/use-cases/session.use-cases";
import {
  AuthTokensType,
  ChangePasswordInput,
  LoginInput,
  LoginResultType,
  ResetPasswordInput,
  SessionUserType,
  UpdateMyProfileInput,
  VerifyRecoveryCodeInput,
} from "@/modules/identity/presentation/graphql/identity.graphql-types";

type SessionSubject = Omit<SessionUserType, "permissions">;

@Resolver()
export class AuthResolver {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly changeOwnPassword: ChangeOwnPasswordUseCase,
    private readonly updateOwnProfile: UpdateOwnProfileUseCase,
    private readonly recovery: PasswordRecoveryUseCase,
    private readonly permissions: PermissionsService,
  ) {}

  @Public()
  @Mutation(() => LoginResultType, {
    description: "Entra com usuário (ou e-mail) e senha.",
  })
  async login(
    @Args("input") input: LoginInput,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<LoginResultType> {
    const result = await this.loginUseCase.execute(input, meta);
    return {
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshToken: result.refreshToken,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      user: await this.toSessionUser({
        ...result.user,
        mustChangePassword: result.mustChangePassword,
      }),
    };
  }

  @Public()
  @Mutation(() => AuthTokensType, {
    description: "Novo access token a partir do refresh token da sessão.",
  })
  refreshSessionTokens(
    @Args("refreshToken") refreshToken: string,
  ): Promise<AuthTokensType> {
    return this.refreshSession.execute(refreshToken);
  }

  @AllowFirstAccess()
  @Mutation(() => Boolean, { description: "Encerra a sessão atual." })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<boolean> {
    await this.logoutUseCase.execute(user.sessionId);
    return true;
  }

  @AllowFirstAccess()
  @Query(() => SessionUserType)
  me(@CurrentUser() user: AuthenticatedUser): Promise<SessionUserType> {
    return this.toSessionUser(user);
  }

  @AllowFirstAccess()
  @Mutation(() => Boolean, {
    description:
      "Troca a própria senha (inclusive a temporária). Encerra as outras sessões.",
  })
  async changeMyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input") input: ChangePasswordInput,
  ): Promise<boolean> {
    await this.changeOwnPassword.execute(user, input);
    return true;
  }

  @Mutation(() => SessionUserType)
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input") input: UpdateMyProfileInput,
  ): Promise<SessionUserType> {
    const updated = await this.updateOwnProfile.execute(user, input);
    return this.toSessionUser({
      ...updated,
      mustChangePassword: user.mustChangePassword,
    });
  }

  @Public()
  @Mutation(() => Boolean, {
    description:
      "Envia um código por e-mail. Sempre responde true, exista ou não o usuário.",
  })
  async requestPasswordRecovery(
    @Args("login") login: string,
  ): Promise<boolean> {
    await this.recovery.request(login.slice(0, 254));
    return true;
  }

  @Public()
  @Mutation(() => String, {
    description: "Confere o código e devolve o token para redefinir a senha.",
  })
  verifyPasswordRecoveryCode(
    @Args("input") input: VerifyRecoveryCodeInput,
  ): Promise<string> {
    return this.recovery.verify(input.login, input.code);
  }

  @Public()
  @Mutation(() => Boolean)
  async resetPasswordWithRecovery(
    @Args("input") input: ResetPasswordInput,
  ): Promise<boolean> {
    await this.recovery.reset(input.resetToken, input.newPassword);
    return true;
  }

  private async toSessionUser(
    subject: SessionSubject,
  ): Promise<SessionUserType> {
    const matrix = await this.permissions.matrixFor(subject);
    return {
      id: subject.id,
      name: subject.name,
      username: subject.username,
      email: subject.email,
      group: subject.group,
      mustChangePassword: subject.mustChangePassword,
      permissions: matrix.effective,
    };
  }
}
