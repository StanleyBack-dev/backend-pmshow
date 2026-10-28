import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { BandFunctionsModule } from "@/modules/band-functions/band-functions.module";
import { DutySchedulesUseCase } from "@/modules/duty-schedules/application/duty-schedules.use-cases";
import { DUTY_SCHEDULE_REPOSITORY } from "@/modules/duty-schedules/application/ports/duty-schedule-repository.port";
import {
  DutyScheduleEventOrmEntity,
  DutyScheduleMemberOrmEntity,
  DutyScheduleOrmEntity,
} from "@/modules/duty-schedules/infrastructure/persistence/typeorm/duty-schedule.orm-entity";
import { DutyScheduleTypeormRepository } from "@/modules/duty-schedules/infrastructure/persistence/typeorm/duty-schedule-typeorm.repository";
import { DutySchedulesResolver } from "@/modules/duty-schedules/presentation/graphql/duty-schedules.resolver";
import { EventsModule } from "@/modules/events/events.module";
import { MembersModule } from "@/modules/members/members.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { RostersModule } from "@/modules/rosters/rosters.module";

// Expedientes: weeks or months of working days, built on events and rosters
// (one EXPEDIENTE event per day, roster already published).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DutyScheduleOrmEntity,
      DutyScheduleEventOrmEntity,
      DutyScheduleMemberOrmEntity,
    ]),
    AuditModule,
    BandFunctionsModule,
    EventsModule,
    MembersModule,
    OutboxModule,
    RostersModule,
  ],
  providers: [
    DutySchedulesUseCase,
    DutySchedulesResolver,
    {
      provide: DUTY_SCHEDULE_REPOSITORY,
      useClass: DutyScheduleTypeormRepository,
    },
  ],
})
export class DutySchedulesModule {}
