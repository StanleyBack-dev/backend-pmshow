import { Controller, Post } from "@nestjs/common";
import { InternalRoute } from "@/common/decorators/internal-route.decorator";
import {
  OutboxDispatcher,
  type DispatchReport,
} from "@/modules/outbox/application/outbox-dispatcher.service";

// Called by the scheduled GitHub Actions workflow (CRON_SECRET): retries
// what the best-effort delivery after each commit could not send.
@InternalRoute()
@Controller("internal/outbox")
export class InternalOutboxController {
  constructor(private readonly dispatcher: OutboxDispatcher) {}

  @Post("process")
  process(): Promise<DispatchReport> {
    return this.dispatcher.process();
  }
}
