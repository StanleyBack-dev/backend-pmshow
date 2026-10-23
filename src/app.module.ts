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
  ],
  providers: [
    AppResolver,
    // Order matters: the BFF key is checked before the user session guard.
    { provide: APP_GUARD, useClass: InternalApiKeyGuard },
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
