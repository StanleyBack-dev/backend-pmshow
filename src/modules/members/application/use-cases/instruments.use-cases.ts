import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  INSTRUMENT_REPOSITORY,
  type InstrumentRepositoryPort,
} from "@/modules/members/application/ports/instrument-repository.port";
import type { Instrument, Section } from "@/modules/members/domain/member";

// The instrument catalog (seeded by the migration). Instruments are archived,
// never deleted, so past profiles and rosters keep their names.
@Injectable()
export class InstrumentsUseCase {
  constructor(
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instruments: InstrumentRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(includeArchived: boolean): Promise<Instrument[]> {
    return this.instruments.list(includeArchived);
  }

  async create(
    actor: AuthenticatedUser,
    input: { name: string; section: Section },
  ): Promise<Instrument> {
    const name = input.name.trim().replace(/\s+/g, " ");
    await this.assertNameFree(name);
    const created = await this.instruments.create({
      name,
      section: input.section,
    });
    await this.record(actor, "instrument.created", created.id, {
      name,
      section: input.section,
    });
    return created;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    patch: { name?: string; section?: Section; archived?: boolean },
  ): Promise<Instrument> {
    const current = await this.instruments.findById(id);
    if (!current) {
      throw AppException.from(APP_ERRORS.members.instrumentNotFound, undefined);
    }
    const name = patch.name?.trim().replace(/\s+/g, " ");
    if (name && name.toLowerCase() !== current.name.toLowerCase()) {
      await this.assertNameFree(name);
    }
    const updated = await this.instruments.update(id, {
      name,
      section: patch.section,
      archived: patch.archived,
    });
    await this.record(actor, "instrument.updated", id, {
      name: updated.name,
      section: updated.section,
      archived: updated.archived,
    });
    return updated;
  }

  private async assertNameFree(name: string): Promise<void> {
    if (await this.instruments.findByName(name)) {
      throw AppException.from(
        APP_ERRORS.members.instrumentNameTaken,
        undefined,
      );
    }
  }

  private record(
    actor: AuthenticatedUser,
    action: string,
    id: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action,
      entity: "instrument",
      entityId: id,
      after,
    });
  }
}
