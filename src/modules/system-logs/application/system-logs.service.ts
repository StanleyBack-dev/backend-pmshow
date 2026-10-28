import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  setSystemEventSink,
  type SystemEvent,
} from "@/common/logging/system-events";
import { redact } from "@/common/logging/redact";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import {
  LOG_RETENTION_DAYS,
  alertKey,
  clip,
} from "@/modules/system-logs/domain/system-log";
import {
  SYSTEM_LOG_REPOSITORY,
  type SystemLogFilter,
  type SystemLogRepositoryPort,
  type SystemLogSummary,
  type SystemLogView,
} from "@/modules/system-logs/application/ports/system-log-repository.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const LEVEL_LABELS: Record<SystemEvent["level"], string> = {
  INFO: "Informação",
  WARN: "Atenção",
  ERROR: "Erro",
  CRITICAL: "Crítico",
};

// The system log (Administração → Logs) and the alerts to the ADMIN_MASTER:
// unexpected API and database errors, security events, notices that could
// not be delivered, failed GitHub Actions routines and screen errors.
@Injectable()
export class SystemLogsService implements OnModuleInit {
  private readonly logger = new Logger(SystemLogsService.name);
  private readonly environment: string;

  constructor(
    @Inject(SYSTEM_LOG_REPOSITORY)
    private readonly logs: SystemLogRepositoryPort,
    private readonly users: UserLookupService,
    private readonly outbox: OutboxDispatcher,
    @Inject(CLOCK) private readonly clock: ClockPort,
    config: ConfigService,
  ) {
    this.environment = clip(
      config.get<string>("VERCEL_ENV") ||
        config.get<string>("NODE_ENV") ||
        "development",
      20,
    );
  }

  onModuleInit(): void {
    setSystemEventSink((event) => void this.record(event));
  }

  /** Stores the event and, when asked, alerts the administrators. */
  async record(event: SystemEvent): Promise<void> {
    try {
      const details = event.details
        ? (JSON.parse(redact(JSON.stringify(event.details))) as Record<
            string,
            unknown
          >)
        : null;
      await this.logs.insert({
        level: event.level,
        category: event.category,
        source: clip(event.source, 200),
        message: clip(redact(event.message), 1000),
        details,
        userId: event.userId ?? null,
        ip: event.ip ? clip(event.ip, 64) : null,
        statusCode: event.statusCode ?? null,
        durationMs:
          event.durationMs == null ? null : Math.round(event.durationMs),
        environment: this.environment,
      });
      if (event.alert) await this.alert(event);
    } catch (error) {
      // Never loop back into the log: only the platform's own output.
      this.logger.error(`Log do sistema não gravado: ${redact(String(error))}`);
    }
  }

  list(
    filter: SystemLogFilter,
    page: PageRequest,
  ): Promise<Paginated<SystemLogView>> {
    return this.logs.page(filter, page);
  }

  summary(): Promise<SystemLogSummary[]> {
    return this.logs.summary(this.clock.now());
  }

  /** Daily cleanup: logs older than the retention. */
  purgeOld(now: Date): Promise<number> {
    return this.logs.purgeBefore(
      new Date(now.getTime() - LOG_RETENTION_DAYS * 86_400_000),
    );
  }

  // One notice per kind and source per window (the outbox dedupe key makes
  // it hold across server instances too).
  private async alert(event: SystemEvent): Promise<void> {
    const admins = await this.users.activeUserIdsInGroup(
      UserGroup.ADMIN_MASTER,
    );
    if (admins.length === 0) return;
    const key = alertKey(event, this.clock.now());
    const title = `${LEVEL_LABELS[event.level]}: ${clip(event.source, 80)}`;
    const message = clip(redact(event.message), 400);
    await this.outbox.enqueue(
      admins.map((userId) =>
        deliveryDraft(
          {
            userId,
            type: NotificationType.SYSTEM_ALERT,
            title,
            body: message,
            link: "/admin/logs",
            email: {
              subject: `[PM SHOW] ${title}`,
              intro:
                "O sistema registrou um problema que precisa da sua atenção. Os detalhes estão em Administração → Logs.",
              details: [
                { label: "Nível", value: LEVEL_LABELS[event.level] },
                { label: "Tipo", value: event.category },
                { label: "Origem", value: clip(event.source, 200) },
                { label: "Mensagem", value: message },
                { label: "Ambiente", value: this.environment },
              ],
              ctaLabel: "Ver os logs",
            },
            calendar: null,
          },
          `${key}:${userId}`,
        ),
      ),
    );
    this.outbox.kick();
  }
}
