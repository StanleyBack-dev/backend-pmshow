import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DataSource, Repository } from "typeorm";
import type { PermissionOverrideRepositoryPort } from "@/modules/access-control/application/ports/permission-override-repository.port";
import type { PermissionOverride } from "@/modules/access-control/domain/permission-policy";
import { PermissionOverrideOrmEntity } from "@/modules/access-control/infrastructure/persistence/typeorm/entities/permission-override.orm-entity";

@Injectable()
export class PermissionOverrideTypeormRepository implements PermissionOverrideRepositoryPort {
  constructor(
    @InjectRepository(PermissionOverrideOrmEntity)
    private readonly repository: Repository<PermissionOverrideOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findByUser(userId: string): Promise<PermissionOverride[]> {
    const rows = await this.repository.find({ where: { userId } });
    return rows.map(({ permission, allowed }) => ({ permission, allowed }));
  }

  async replaceForUser(
    userId: string,
    overrides: readonly PermissionOverride[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PermissionOverrideOrmEntity);
      await repository.delete({ userId });
      if (overrides.length > 0) {
        await repository.insert(
          overrides.map(({ permission, allowed }) => ({
            userId,
            permission,
            allowed,
          })),
        );
      }
    });
  }
}
