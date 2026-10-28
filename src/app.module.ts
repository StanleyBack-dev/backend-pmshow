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
import { DutySchedulesModule } from "@/modules/duty-schedules/duty-schedules.module";
import { EnrollmentModule } from "@/modules/enrollment/enrollment.module";
import { EventsModule } from "@/modules/events/events.module";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { PermissionsGuard } from "@/modules/access-control/presentation/guards/permissions.guard";
import { ArtistsModule } from "@/modules/artists/artists.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { AvailabilityModule } from "@/modules/availability/availability.module";
import { BroadcastsModule } from "@/modules/broadcasts/broadcasts.module";
import { SupportModule } from "@/modules/support/support.module";
import { DashboardModule } from "@/modules/dashboard/dashboard.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { FirstAccessGuard } from "@/modules/identity/presentation/guards/first-access.guard";
import { UserSessionGuard } from "@/modules/identity/presentation/guards/user-session.guard";
import { MailModule } from "@/modules/mails/mail.module";
import { MaintenanceModule } from "@/modules/maintenance/maintenance.module";
import { MediaModule } from "@/modules/media/media.module";
import { BandFunctionsModule } from "@/modules/band-functions/band-functions.module";
import { MembersModule } from "@/modules/members/members.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { ProfilePhotosModule } from "@/modules/profile-photos/profile-photos.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { RepertoireModule } from "@/modules/repertoire/repertoire.module";
import { RostersModule } from "@/modules/rosters/rosters.module";
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
    BandFunctionsModule,
    MembersModule,
    EnrollmentModule,
    ArtistsModule,
    RepertoireModule,
    MediaModule,
    ProfilePhotosModule,
    EventsModule,
    OutboxModule,
    NotificationsModule,
    AvailabilityModule,
    RostersModule,
    DutySchedulesModule,
    BroadcastsModule,
    SupportModule,
    DashboardModule,
    MaintenanceModule,
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
