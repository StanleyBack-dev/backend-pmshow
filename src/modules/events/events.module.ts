import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { EventsUseCase } from "@/modules/events/application/events.use-cases";
import {
  EVENT_REPOSITORY,
  VENUE_REPOSITORY,
  ZIP_CODE_LOOKUP,
} from "@/modules/events/application/ports/events.ports";
import { VenuesUseCase } from "@/modules/events/application/venues.use-cases";
import { ViaCepAdapter } from "@/modules/events/infrastructure/zip-code/viacep.adapter";
import {
  EventOrmEntity,
  EventSongOrmEntity,
  VenueOrmEntity,
} from "@/modules/events/infrastructure/persistence/typeorm/event.orm-entity";
import {
  EventTypeormRepository,
  VenueTypeormRepository,
} from "@/modules/events/infrastructure/persistence/typeorm/events-typeorm.repositories";
import {
  EventFieldsResolver,
  EventsResolver,
  SetlistEntryFieldsResolver,
  VenueFieldsResolver,
} from "@/modules/events/presentation/graphql/events.resolver";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { RepertoireModule } from "@/modules/repertoire/repertoire.module";

// The agenda: events (shows, parades, rehearsals…), their venues and
// setlists. Rosters attach to events from their own module and learn about
// schedule changes through the outbox ("event.changed").
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventOrmEntity,
      VenueOrmEntity,
      EventSongOrmEntity,
    ]),
    RepertoireModule,
    AuditModule,
    OutboxModule,
  ],
  providers: [
    EventsUseCase,
    VenuesUseCase,
    EventsResolver,
    EventFieldsResolver,
    SetlistEntryFieldsResolver,
    VenueFieldsResolver,
    { provide: EVENT_REPOSITORY, useClass: EventTypeormRepository },
    { provide: VENUE_REPOSITORY, useClass: VenueTypeormRepository },
    { provide: ZIP_CODE_LOOKUP, useClass: ViaCepAdapter },
  ],
  exports: [EventsUseCase, VenuesUseCase],
})
export class EventsModule {}
