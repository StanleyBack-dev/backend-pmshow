import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditEntry,
  type AuditEntryInput,
  type AuditFilter,
  type AuditLogRepositoryPort,
} from "@/modules/audit/application/ports/audit-log-repository.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

// Public API of the audit module. Recording runs after the audited change
// succeeded: a failure to write the trail is logged loudly but never undoes
// or fails the operation the user already completed.
@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repository: AuditLogRepositoryPort,
  ) {}

  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await this.repository.append(entry);
    } catch (error) {
      this.logger.error(
        `Falha ao registrar auditoria ${entry.action} (${entry.entity}:${entry.entityId ?? "-"}): ${String(error)}`,
      );
    }
  }

  list(filter: AuditFilter, page: PageRequest): Promise<Paginated<AuditEntry>> {
    return this.repository.list(filter, page);
  }
}
