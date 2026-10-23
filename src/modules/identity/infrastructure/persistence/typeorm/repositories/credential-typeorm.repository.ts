import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type {
  CredentialPatch,
  CredentialRepositoryPort,
} from "@/modules/identity/application/ports/credential-repository.port";
import type { Credential } from "@/modules/identity/domain/user";
import { CredentialOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/credential.orm-entity";

@Injectable()
export class CredentialTypeormRepository implements CredentialRepositoryPort {
  constructor(
    @InjectRepository(CredentialOrmEntity)
    private readonly repository: Repository<CredentialOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<Credential | null> {
    const row = await this.repository.findOne({ where: { userId } });
    if (!row) return null;
    return {
      userId: row.userId,
      passwordHash: row.passwordHash,
      mustChangePassword: row.mustChangePassword,
      failedLoginAttempts: row.failedLoginAttempts,
      lockedUntil: row.lockedUntil,
      passwordChangedAt: row.passwordChangedAt,
    };
  }

  async update(userId: string, patch: CredentialPatch): Promise<void> {
    await this.repository.update({ userId }, patch);
  }
}
