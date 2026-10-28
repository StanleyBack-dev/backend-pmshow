import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  BAND_FUNCTION_REPOSITORY,
  type BandFunctionFilter,
  type BandFunctionRepositoryPort,
} from "@/modules/band-functions/application/ports/band-function-repository.port";
import {
  normalizeFunctionName,
  type BandFunction,
  type BandFunctionListItem,
} from "@/modules/band-functions/domain/band-function";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

@Injectable()
export class BandFunctionsUseCase {
  constructor(
    @Inject(BAND_FUNCTION_REPOSITORY)
    private readonly functions: BandFunctionRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(includeArchived: boolean): Promise<BandFunction[]> {
    return this.functions.list(includeArchived);
  }

  page(
    filter: BandFunctionFilter,
    page: PageRequest,
  ): Promise<Paginated<BandFunctionListItem>> {
    return this.functions.page(filter, page);
  }

  findByIds(ids: readonly string[]): Promise<BandFunction[]> {
    return this.functions.findByIds([...new Set(ids)]);
  }

  async create(
    actor: AuthenticatedUser,
    input: { name: string },
  ): Promise<BandFunction> {
    const name = normalizeFunctionName(input.name);
    await this.assertNameFree(name);
    const created = await this.functions.create({ name });
    await this.stamp(actor, created.id, true);
    return created;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    patch: { name?: string; archived?: boolean },
  ): Promise<BandFunction> {
    const current = await this.functions.findById(id);
    if (!current) {
      throw AppException.from(
        APP_ERRORS.bandFunctions.functionNotFound,
        undefined,
      );
    }
    const name = patch.name ? normalizeFunctionName(patch.name) : undefined;
    if (name && name.toLowerCase() !== current.name.toLowerCase()) {
      await this.assertNameFree(name);
    }
    const updated = await this.functions.update(id, {
      name,
      archived: patch.archived,
    });
    await this.stamp(actor, id);
    return updated;
  }

  private async assertNameFree(name: string): Promise<void> {
    if (await this.functions.findByName(name)) {
      throw AppException.from(
        APP_ERRORS.bandFunctions.functionNameTaken,
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
      entity: "band_function",
      entityId: id,
      created,
    });
  }
}
