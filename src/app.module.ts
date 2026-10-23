import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { GraphQLModule } from "@nestjs/graphql";
import type { ApolloDriverConfig } from "@nestjs/apollo";
import { AppController } from "@/app.controller";
import { AppResolver } from "@/app.resolver";
import { HttpExceptionFilter } from "@/common/filters/http-exception.filter";
import { buildGraphqlConfig } from "@/common/graphql/graphql.config";
import { InternalApiKeyGuard } from "@/common/security/internal-api-key.guard";
import { AppConfigModule } from "@/config/config.module";
import { DatabaseModule } from "@/database/database.module";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { PermissionsGuard } from "@/modules/access-control/presentation/guards/permissions.guard";
import { AuditModule } from "@/modules/audit/audit.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { FirstAccessGuard } from "@/modules/identity/presentation/guards/first-access.guard";
import { UserSessionGuard } from "@/modules/identity/presentation/guards/user-session.guard";
import { MailModule } from "@/modules/mails/mail.module";
import { SharedModule } from "@/shared/shared.module";

@Module({
  controllers: [AppController],
  imports: [
    AppConfigModule,
    DatabaseModule,
    GraphQLModule.forRoot<ApolloDriverConfig>(buildGraphqlConfig()),
    SharedModule,
    MailModule,
    AuditModule,
    AccessControlModule,
    IdentityModule,
  ],
  providers: [
    AppResolver,
    // Global guards run in this order: BFF key → session (sets
    // request.user) → first access (temporary password) → permissions.
    { provide: APP_GUARD, useClass: InternalApiKeyGuard },
    { provide: APP_GUARD, useExisting: UserSessionGuard },
    { provide: APP_GUARD, useExisting: FirstAccessGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
