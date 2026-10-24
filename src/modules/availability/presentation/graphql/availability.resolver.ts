import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AbsencesUseCase } from "@/modules/availability/application/absences.use-cases";
import type { AbsenceView } from "@/modules/availability/application/ports/absence-repository.port";
import {
  AbsenceFilterInput,
  AbsenceGqlType,
  AbsenceInput,
} from "@/modules/availability/presentation/graphql/availability.graphql-types";

const Id = () => new ParseUUIDPipe({ version: "4" });

@Resolver()
export class AvailabilityResolver {
  constructor(
    private readonly absencesUseCase: AbsencesUseCase,
    private readonly permissions: PermissionsService,
  ) {}

  @RequirePermissions(Permission.ABSENCES_REQUEST)
  @Query(() => [AbsenceGqlType])
  myAbsences(@CurrentUser() user: AuthenticatedUser): Promise<AbsenceView[]> {
    return this.absencesUseCase.listMine(user.id);
  }

  @RequirePermissions(Permission.ABSENCES_MANAGE)
  @Query(() => [AbsenceGqlType], { description: "Até 500, das mais recentes." })
  absences(
    @Args("filter", { nullable: true }) filter?: AbsenceFilterInput,
  ): Promise<AbsenceView[]> {
    const { userId, statuses, from, to } = filter ?? {};
    return this.absencesUseCase.list({
      userIds: userId ? [userId] : undefined,
      statuses,
      period:
        from || to
          ? { startsOn: from ?? "0001-01-01", endsOn: to ?? "9999-12-31" }
          : undefined,
    });
  }

  @RequirePermissions(Permission.ABSENCES_REQUEST)
  @Mutation(() => AbsenceGqlType, { description: "Pede para si (pendente)." })
  requestAbsence(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input") input: AbsenceInput,
  ): Promise<AbsenceView> {
    return this.absencesUseCase.request(user, input);
  }

  @RequirePermissions(Permission.ABSENCES_MANAGE)
  @Mutation(() => AbsenceGqlType, {
    description: "Lança para alguém, já aprovada.",
  })
  registerAbsence(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("userId", { type: () => ID }, Id()) userId: string,
    @Args("input") input: AbsenceInput,
  ): Promise<AbsenceView> {
    return this.absencesUseCase.register(actor, userId, input);
  }

  @RequirePermissions(Permission.ABSENCES_MANAGE)
  @Mutation(() => AbsenceGqlType)
  reviewAbsence(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("approve") approve: boolean,
    @Args("note", { type: () => String, nullable: true }) note: string | null,
  ): Promise<AbsenceView> {
    return this.absencesUseCase.review(actor, id, approve, note ?? null);
  }

  @RequirePermissions(Permission.ABSENCES_REQUEST)
  @Mutation(() => AbsenceGqlType)
  async cancelAbsence(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<AbsenceView> {
    const granted = await this.permissions.effectiveFor(actor);
    return this.absencesUseCase.cancel(
      actor,
      id,
      granted.has(Permission.ABSENCES_MANAGE),
    );
  }
}
