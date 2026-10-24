import { Controller, Post } from "@nestjs/common";
import { InternalRoute } from "@/common/decorators/internal-route.decorator";
import {
  OutboxDispatcher,
  type DispatchReport,
} from "@/modules/outbox/application/outbox-dispatcher.service";
import { RostersUseCase } from "@/modules/rosters/application/rosters.use-cases";

// Called every morning by the scheduled GitHub Actions workflow (CRON_SECRET).
@InternalRoute()
@Controller("internal/rosters")
export class InternalRostersController {
  constructor(
    private readonly rosters: RostersUseCase,
    private readonly dispatcher: OutboxDispatcher,
  ) {}

  /** Reminders for today's and tomorrow's events, delivered right away. */
  @Post("reminders")
  async reminders(): Promise<
    { events: number; reminders: number } & { delivery: DispatchReport }
  > {
    const result = await this.rosters.sendReminders();
    return { ...result, delivery: await this.dispatcher.process() };
  }
}
