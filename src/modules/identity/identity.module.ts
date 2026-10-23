import { Module, type OnApplicationBootstrap } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { IdentityConfig } from "@/modules/identity/application/identity.config";
import { PasswordService } from "@/modules/identity/application/password.service";
import { ACCESS_TOKEN } from "@/modules/identity/application/ports/access-token.port";
import { CREDENTIAL_REPOSITORY } from "@/modules/identity/application/ports/credential-repository.port";
import { IDENTITY_NOTIFIER } from "@/modules/identity/application/ports/identity-notifier.port";
import { PASSWORD_HASHER } from "@/modules/identity/application/ports/password-hasher.port";
import { PRINCIPAL_READER } from "@/modules/identity/application/ports/principal-reader.port";
import { SECRETS } from "@/modules/identity/application/ports/secrets.port";
import { SESSION_REPOSITORY } from "@/modules/identity/application/ports/session-repository.port";
import { USER_REPOSITORY } from "@/modules/identity/application/ports/user-repository.port";
import { VERIFICATION_CODE_REPOSITORY } from "@/modules/identity/application/ports/verification-code-repository.port";
import { SessionTokensService } from "@/modules/identity/application/session-tokens.service";
import { BootstrapAdminMasterUseCase } from "@/modules/identity/application/use-cases/bootstrap-admin-master.use-case";
import { LoginUseCase } from "@/modules/identity/application/use-cases/login.use-case";
import {
  ManageUsersUseCase,
  UserDirectoryUseCase,
  UserManagementPolicy,
  UserPermissionsUseCase,
} from "@/modules/identity/application/use-cases/manage-users.use-cases";
import {
  ChangeOwnPasswordUseCase,
  UpdateOwnProfileUseCase,
} from "@/modules/identity/application/use-cases/own-account.use-cases";
import { PasswordRecoveryUseCase } from "@/modules/identity/application/use-cases/password-recovery.use-case";
import {
  AuthenticateUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
} from "@/modules/identity/application/use-cases/session.use-cases";
import { JwtAccessTokenService } from "@/modules/identity/infrastructure/crypto/jwt-access-token.service";
import { NodeSecrets } from "@/modules/identity/infrastructure/crypto/node-secrets";
import { ScryptPasswordHasher } from "@/modules/identity/infrastructure/crypto/scrypt-password-hasher";
import { MailIdentityNotifier } from "@/modules/identity/infrastructure/notifications/mail-identity.notifier";
import { CredentialOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/credential.orm-entity";
import { SessionOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/session.orm-entity";
import { UserOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/user.orm-entity";
import { VerificationCodeOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/verification-code.orm-entity";
import { CredentialTypeormRepository } from "@/modules/identity/infrastructure/persistence/typeorm/repositories/credential-typeorm.repository";
import { PrincipalTypeormReader } from "@/modules/identity/infrastructure/persistence/typeorm/repositories/principal-typeorm.reader";
import { SessionTypeormRepository } from "@/modules/identity/infrastructure/persistence/typeorm/repositories/session-typeorm.repository";
import { UserTypeormRepository } from "@/modules/identity/infrastructure/persistence/typeorm/repositories/user-typeorm.repository";
import { VerificationCodeTypeormRepository } from "@/modules/identity/infrastructure/persistence/typeorm/repositories/verification-code-typeorm.repository";
import { AuthResolver } from "@/modules/identity/presentation/graphql/auth.resolver";
import { UserAccountFieldsResolver } from "@/modules/identity/presentation/graphql/user-account-fields.resolver";
import { UsersAdminResolver } from "@/modules/identity/presentation/graphql/users-admin.resolver";
import { FirstAccessGuard } from "@/modules/identity/presentation/guards/first-access.guard";
import { UserSessionGuard } from "@/modules/identity/presentation/guards/user-session.guard";
import { MailModule } from "@/modules/mails/mail.module";

// Users, credentials, sessions and password recovery: who someone is and how
// they sign in. Authorization (what they may do) lives in access-control.
// The session and first-access guards are registered globally by AppModule.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      CredentialOrmEntity,
      SessionOrmEntity,
      VerificationCodeOrmEntity,
    ]),
    AccessControlModule,
    AuditModule,
    MailModule,
  ],
  providers: [
    IdentityConfig,
    PasswordService,
    SessionTokensService,
    UserManagementPolicy,
    // use cases
    AuthenticateUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    ChangeOwnPasswordUseCase,
    UpdateOwnProfileUseCase,
    PasswordRecoveryUseCase,
    UserDirectoryUseCase,
    ManageUsersUseCase,
    UserPermissionsUseCase,
    BootstrapAdminMasterUseCase,
    // adapters
    { provide: USER_REPOSITORY, useClass: UserTypeormRepository },
    { provide: CREDENTIAL_REPOSITORY, useClass: CredentialTypeormRepository },
    { provide: SESSION_REPOSITORY, useClass: SessionTypeormRepository },
    {
      provide: VERIFICATION_CODE_REPOSITORY,
      useClass: VerificationCodeTypeormRepository,
    },
    { provide: PRINCIPAL_READER, useClass: PrincipalTypeormReader },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: ACCESS_TOKEN, useClass: JwtAccessTokenService },
    { provide: SECRETS, useClass: NodeSecrets },
    { provide: IDENTITY_NOTIFIER, useClass: MailIdentityNotifier },
    // presentation
    AuthResolver,
    UsersAdminResolver,
    UserAccountFieldsResolver,
    UserSessionGuard,
    FirstAccessGuard,
  ],
  exports: [UserSessionGuard, FirstAccessGuard],
})
export class IdentityModule implements OnApplicationBootstrap {
  constructor(private readonly bootstrapAdmin: BootstrapAdminMasterUseCase) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bootstrapAdmin.execute();
  }
}
