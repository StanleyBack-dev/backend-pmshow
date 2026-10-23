import { Controller, Get, SetMetadata } from "@nestjs/common";
import { Public } from "@/common/decorators/public.decorator";
import { SKIP_INTERNAL_KEY } from "@/common/security/internal-api-key.guard";

@Controller()
export class AppController {
  // Open health check for uptime monitors — exposes nothing else.
  @Public()
  @SetMetadata(SKIP_INTERNAL_KEY, true)
  @Get()
  health() {
    return { service: "backend-pmshow", status: "ok" };
  }
}
