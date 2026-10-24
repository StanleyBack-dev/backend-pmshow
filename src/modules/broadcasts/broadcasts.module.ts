import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { BroadcastsUseCase } from "@/modules/broadcasts/application/broadcasts.use-cases";
import { BROADCAST_REPOSITORY } from "@/modules/broadcasts/application/ports/broadcast-repository.port";
import { BroadcastOrmEntity } from "@/modules/broadcasts/infrastructure/persistence/typeorm/broadcast.orm-entity";
import { BroadcastTypeormRepository } from "@/modules/broadcasts/infrastructure/persistence/typeorm/broadcast-typeorm.repository";
import { BroadcastsResolver } from "@/modules/broadcasts/presentation/graphql/broadcasts.resolver";
import { EventsModule } from "@/modules/events/events.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MembersModule } from "@/modules/members/members.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { RostersModule } from "@/modules/rosters/rosters.module";

// Announcements (comunicados): picks the audience through identity, members
// and rosters, and notifies through the outbox like every other notice.
@Module({
  imports: [
    TypeOrmModule.forFeature([BroadcastOrmEntity]),
    AuditModule,
    EventsModule,
    IdentityModule,
    MembersModule,
    OutboxModule,
    RostersModule,
  ],
  providers: [
    BroadcastsUseCase,
    BroadcastsResolver,
    { provide: BROADCAST_REPOSITORY, useClass: BroadcastTypeormRepository },
  ],
})
export class BroadcastsModule {}
