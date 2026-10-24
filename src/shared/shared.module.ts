import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK } from "@/shared/application/ports/clock.port";
import { LOCK } from "@/shared/application/ports/lock.port";
import { RATE_LIMIT } from "@/shared/application/ports/rate-limit.port";
import { SystemClock } from "@/shared/infrastructure/system-clock";
import { LeaseLockRepository } from "@/shared/infrastructure/persistence/lease-lock.repository";
import { LockOrmEntity } from "@/shared/infrastructure/persistence/lock.orm-entity";
import { RateLimitRepository } from "@/shared/infrastructure/persistence/rate-limit.repository";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([LockOrmEntity])],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: LOCK, useClass: LeaseLockRepository },
    { provide: RATE_LIMIT, useClass: RateLimitRepository },
  ],
  exports: [CLOCK, LOCK, RATE_LIMIT],
})
export class SharedModule {}
