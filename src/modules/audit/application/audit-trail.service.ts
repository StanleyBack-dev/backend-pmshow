import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  RECORD_STAMP_REPOSITORY,
  type RecordStampRepositoryPort,
} from "@/modules/audit/application/ports/record-stamp-repository.port";
import type {
  RecordStamp,
  StampedEntity,
  StampInput,
} from "@/modules/audit/domain/record-stamp";
import { redact } from "@/common/logging/redact";

// Public API of the audit module: stamps who created and who last changed a
// record, in the record's own table. Stamping runs after the change
// succeeded; a failure is logged loudly but never undoes or fails the
// operation the user already completed.
@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(
    @Inject(RECORD_STAMP_REPOSITORY)
    private readonly repository: RecordStampRepositoryPort,
  ) {}

  async stamp(input: StampInput): Promise<void> {
    try {
      await this.repository.stamp(input);
    } catch (error) {
      this.logger.error(
        `Falha ao registrar a alteração de ${input.entity}:${input.entityId}: ${redact(String(error))}`,
      );
    }
  }

  /** One stamp for many records (bulk creations). */
  async stampMany(
    input: Omit<StampInput, "entityId"> & { entityIds: readonly string[] },
  ): Promise<void> {
    try {
      await this.repository.stampMany(input);
    } catch (error) {
      this.logger.error(
        `Falha ao registrar a alteração de ${input.entity} (${input.entityIds.length}): ${redact(String(error))}`,
      );
    }
  }

  find(entity: StampedEntity, id: string): Promise<RecordStamp | null> {
    return this.repository.find(entity, id);
  }
}
