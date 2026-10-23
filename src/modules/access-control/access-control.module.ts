import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { PERMISSION_OVERRIDE_REPOSITORY } from "@/modules/access-control/application/ports/permission-override-repository.port";
import { PermissionOverrideOrmEntity } from "@/modules/access-control/infrastructure/persistence/typeorm/entities/permission-override.orm-entity";
import { PermissionOverrideTypeormRepository } from "@/modules/access-control/infrastructure/persistence/typeorm/repositories/permission-override-typeorm.repository";
import { PermissionsGuard } from "@/modules/access-control/presentation/guards/permissions.guard";

// Groups, permissions and per-user overrides. Depends on no other module;
// PermissionsGuard is registered globally by AppModule (after the session
// guard).
@Module({
  imports: [TypeOrmModule.forFeature([PermissionOverrideOrmEntity])],
  providers: [
    PermissionsService,
    PermissionsGuard,
    {
      provide: PERMISSION_OVERRIDE_REPOSITORY,
      useClass: PermissionOverrideTypeormRepository,
    },
  ],
  exports: [PermissionsService, PermissionsGuard],
})
export class AccessControlModule {}
