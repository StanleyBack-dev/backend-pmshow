import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { OutboxHandlers } from "@/modules/outbox/application/outbox-handlers";
import { OUTBOX_REPOSITORY } from "@/modules/outbox/application/ports/outbox-repository.port";
import { OutboxMessageOrmEntity } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-message.orm-entity";
import {
  OutboxTypeormRepository,
  OutboxTypeormWriter,
} from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import { InternalOutboxController } from "@/modules/outbox/presentation/rest/internal-outbox.controller";

// Reliable hand-off between modules: producers write messages in their own
// transaction (OutboxTypeormWriter), consumers register handlers per topic
// (OutboxHandlers), and the dispatcher delivers with retries.
@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessageOrmEntity])],
  controllers: [InternalOutboxController],
  providers: [
    OutboxHandlers,
    OutboxDispatcher,
    OutboxTypeormWriter,
    { provide: OUTBOX_REPOSITORY, useClass: OutboxTypeormRepository },
  ],
  exports: [OutboxHandlers, OutboxDispatcher, OutboxTypeormWriter],
})
export class OutboxModule {}
