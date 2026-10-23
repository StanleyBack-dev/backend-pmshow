import { Controller, Post } from "@nestjs/common";
import { InternalRoute } from "@/common/decorators/internal-route.decorator";
import { MediaUseCase } from "@/modules/media/application/media.use-cases";

// Called by the scheduled GitHub Actions workflow (CRON_SECRET).
@InternalRoute()
@Controller("internal/media")
export class InternalMediaController {
  constructor(private readonly media: MediaUseCase) {}

  /** Removes uploads requested more than an hour ago and never confirmed. */
  @Post("purge-stale-uploads")
  purgeStaleUploads(): Promise<{ purged: number }> {
    return this.media.purgeStaleUploads();
  }
}
