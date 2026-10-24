import { Field, Int, ObjectType, Query, Resolver } from "@nestjs/graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import {
  BandDashboardUseCase,
  type BandDashboard,
} from "@/modules/dashboard/application/band-dashboard";

@ObjectType("BandDashboard", { description: "Painel do gestor." })
class BandDashboardType implements BandDashboard {
  @Field(() => Int)
  activeMembers!: number;

  @Field(() => Int)
  awayMembers!: number;

  @Field(() => Int, { description: "Eventos nos próximos 30 dias." })
  upcomingEvents!: number;

  @Field(() => Int, { description: "Desses, sem escala publicada." })
  eventsWithoutRoster!: number;

  @Field(() => Int)
  pendingAcks!: number;

  @Field(() => Int)
  swapRequests!: number;

  @Field(() => Int)
  pendingAbsences!: number;

  @Field(() => Int)
  absentToday!: number;

  @Field(() => Int, { description: "Notificações que falharam de vez." })
  failedNotifications!: number;
}

@Resolver()
export class DashboardResolver {
  constructor(private readonly dashboardUseCase: BandDashboardUseCase) {}

  @RequirePermissions(Permission.ROSTERS_READ_ALL)
  @Query(() => BandDashboardType)
  bandDashboard(): Promise<BandDashboard> {
    return this.dashboardUseCase.get();
  }
}
