import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import {
  DutySchedulesUseCase,
  type DutyScheduleView,
} from "@/modules/duty-schedules/application/duty-schedules.use-cases";
import type { DutySchedule } from "@/modules/duty-schedules/domain/duty-schedule";
import {
  CancelDutyScheduleInput,
  DutyScheduleDetailType,
  DutyScheduleFilterInput,
  DutyScheduleInput,
  DutySchedulePage,
  DutyScheduleType,
} from "@/modules/duty-schedules/presentation/graphql/duty-schedules.graphql-types";
import type { Paginated } from "@/shared/application/pagination";

const Id = () => new ParseUUIDPipe({ version: "4" });

const toType = <T extends DutySchedule>(schedule: T) => ({
  ...schedule,
  dayCount: schedule.eventIds.length,
  memberCount: schedule.userIds.length,
});

// Expedientes: launched and read by who builds rosters (Gestor,
// Administrador geral); musicians see their days in "Minhas escalas".
@Resolver()
export class DutySchedulesResolver {
  constructor(private readonly useCase: DutySchedulesUseCase) {}

  @RequirePermissions(Permission.ROSTERS_MANAGE)
  @Query(() => DutySchedulePage, {
    description: "Expedientes lançados, mais recentes primeiro.",
  })
  async dutySchedulesPage(
    @Args("filter", { nullable: true }) filter?: DutyScheduleFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<ReturnType<typeof toType>>> {
    const result = await this.useCase.page(
      { search: filter?.search, status: filter?.status },
      page ?? { page: 1, limit: 10 },
    );
    return { ...result, items: result.items.map(toType) };
  }

  @RequirePermissions(Permission.ROSTERS_MANAGE)
  @Query(() => DutyScheduleDetailType)
  async dutySchedule(
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<ReturnType<typeof toType<DutyScheduleView>>> {
    return toType(await this.useCase.get(id));
  }

  @RequirePermissions(Permission.ROSTERS_MANAGE, Permission.EVENTS_MANAGE)
  @Mutation(() => DutyScheduleType, {
    description:
      "Lança o expediente: um evento por dia, com a escala publicada; avisa cada pessoa uma vez.",
  })
  async createDutySchedule(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: DutyScheduleInput,
  ): Promise<ReturnType<typeof toType>> {
    return toType(await this.useCase.create(actor, input));
  }

  @RequirePermissions(Permission.ROSTERS_MANAGE, Permission.EVENTS_MANAGE)
  @Mutation(() => DutyScheduleType, {
    description: "Cancela os dias que ainda não aconteceram e avisa uma vez.",
  })
  async cancelDutySchedule(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: CancelDutyScheduleInput,
  ): Promise<ReturnType<typeof toType>> {
    return toType(await this.useCase.cancel(actor, id, input.reason));
  }
}
