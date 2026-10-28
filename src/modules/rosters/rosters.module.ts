import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { AvailabilityModule } from "@/modules/availability/availability.module";
import { BandFunctionsModule } from "@/modules/band-functions/band-functions.module";
import { EventsModule } from "@/modules/events/events.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MembersModule } from "@/modules/members/members.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { ROSTER_REPOSITORY } from "@/modules/rosters/application/ports/roster-repository.port";
import { CalendarFeedsUseCase } from "@/modules/rosters/application/calendar-feeds.use-case";
import { CALENDAR_FEED_REPOSITORY } from "@/modules/rosters/application/ports/calendar-feed-repository.port";
import { RostersUseCase } from "@/modules/rosters/application/rosters.use-cases";
import { CalendarFeedOrmEntity } from "@/modules/rosters/infrastructure/persistence/typeorm/calendar-feed.orm-entity";
import { CalendarFeedTypeormRepository } from "@/modules/rosters/infrastructure/persistence/typeorm/calendar-feed-typeorm.repository";
import { CalendarFeedsResolver } from "@/modules/rosters/presentation/graphql/calendar-feeds.resolver";
import {
  RosterAssignmentOrmEntity,
  RosterOrmEntity,
} from "@/modules/rosters/infrastructure/persistence/typeorm/roster.orm-entity";
import { RosterTypeormRepository } from "@/modules/rosters/infrastructure/persistence/typeorm/roster-typeorm.repository";
import {
  AssignmentFieldsResolver,
  MyAssignmentFieldsResolver,
  RostersResolver,
  EventRosterFieldResolver,
} from "@/modules/rosters/presentation/graphql/rosters.resolver";
import { InternalRostersController } from "@/modules/rosters/presentation/rest/internal-rosters.controller";

// Rosters (escalas): who goes to each event. Reads events, members and
// absences through their use cases; notifies through the outbox.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RosterOrmEntity,
      RosterAssignmentOrmEntity,
      CalendarFeedOrmEntity,
    ]),
    AccessControlModule,
    AuditModule,
    AvailabilityModule,
    BandFunctionsModule,
    EventsModule,
    IdentityModule,
    MembersModule,
    OutboxModule,
  ],
  controllers: [InternalRostersController],
  providers: [
    RostersUseCase,
    CalendarFeedsUseCase,
    CalendarFeedsResolver,
    {
      provide: CALENDAR_FEED_REPOSITORY,
      useClass: CalendarFeedTypeormRepository,
    },
    RostersResolver,
    EventRosterFieldResolver,
    AssignmentFieldsResolver,
    MyAssignmentFieldsResolver,
    { provide: ROSTER_REPOSITORY, useClass: RosterTypeormRepository },
  ],
  exports: [RostersUseCase],
})
export class RostersModule {}
