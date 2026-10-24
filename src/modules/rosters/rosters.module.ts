import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { AvailabilityModule } from "@/modules/availability/availability.module";
import { EventsModule } from "@/modules/events/events.module";
import { MembersModule } from "@/modules/members/members.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { ROSTER_REPOSITORY } from "@/modules/rosters/application/ports/roster-repository.port";
import { RostersUseCase } from "@/modules/rosters/application/rosters.use-cases";
import {
  RosterAssignmentOrmEntity,
  RosterOrmEntity,
} from "@/modules/rosters/infrastructure/persistence/typeorm/roster.orm-entity";
import { RosterTypeormRepository } from "@/modules/rosters/infrastructure/persistence/typeorm/roster-typeorm.repository";
import {
  AssignmentFieldsResolver,
  MyAssignmentFieldsResolver,
  RostersResolver,
} from "@/modules/rosters/presentation/graphql/rosters.resolver";

// Rosters (escalas): who goes to each event. Reads events, members and
// absences through their use cases; notifies through the outbox.
@Module({
  imports: [
    TypeOrmModule.forFeature([RosterOrmEntity, RosterAssignmentOrmEntity]),
    AccessControlModule,
    AuditModule,
    AvailabilityModule,
    EventsModule,
    MembersModule,
    OutboxModule,
  ],
  providers: [
    RostersUseCase,
    RostersResolver,
    AssignmentFieldsResolver,
    MyAssignmentFieldsResolver,
    { provide: ROSTER_REPOSITORY, useClass: RosterTypeormRepository },
  ],
})
export class RostersModule {}
