import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK } from "@/shared/application/ports/clock.port";
import { LOCK } from "@/shared/application/ports/lock.port";
import { SystemClock } from "@/shared/infrastructure/system-clock";
import { LeaseLockRepository } from "@/shared/infrastructure/persistence/lease-lock.repository";
import { LockOrmEntity } from "@/shared/infrastructure/persistence/lock.orm-entity";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([LockOrmEntity])],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: LOCK, useClass: LeaseLockRepository },
  ],
  exports: [CLOCK, LOCK],
})
export class SharedModule {}
