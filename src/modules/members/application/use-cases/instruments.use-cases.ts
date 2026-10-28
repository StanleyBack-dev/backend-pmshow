import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  INSTRUMENT_REPOSITORY,
  type InstrumentFilter,
  type InstrumentRepositoryPort,
} from "@/modules/members/application/ports/instrument-repository.port";
import type {
  Instrument,
  InstrumentListItem,
  Section,
} from "@/modules/members/domain/member";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

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

  page(
    filter: InstrumentFilter,
    page: PageRequest,
  ): Promise<Paginated<InstrumentListItem>> {
    return this.instruments.page(filter, page);
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
    await this.stamp(actor, created.id, true);
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
    await this.stamp(actor, id);
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

  private stamp(
    actor: AuthenticatedUser,
    id: string,
    created = false,
  ): Promise<void> {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "instrument",
      entityId: id,
      created,
    });
  }
}
