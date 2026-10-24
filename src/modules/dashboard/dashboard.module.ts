import { Module } from "@nestjs/common";
import {
  BandDashboardUseCase,
  DASHBOARD_READER,
} from "@/modules/dashboard/application/band-dashboard";
import { DashboardSqlReader } from "@/modules/dashboard/infrastructure/persistence/dashboard-sql.reader";
import { DashboardResolver } from "@/modules/dashboard/presentation/graphql/dashboard.resolver";

// Manager's overview: read-only counts across the band's modules.
@Module({
  providers: [
    BandDashboardUseCase,
    DashboardResolver,
    { provide: DASHBOARD_READER, useClass: DashboardSqlReader },
  ],
})
export class DashboardModule {}
