import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import {
  IsNull,
  MoreThanOrEqual,
  type DataSource,
  type Repository,
} from "typeorm";
import type {
  NewVerificationCode,
  VerificationCode,
  VerificationCodeRepositoryPort,
  VerificationPurpose,
} from "@/modules/identity/application/ports/verification-code-repository.port";
import { VerificationCodeOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/verification-code.orm-entity";

const toCode = (row: VerificationCodeOrmEntity): VerificationCode => ({
  id: row.id,
  userId: row.userId,
  purpose: row.purpose,
  codeHash: row.codeHash,
  attempts: row.attempts,
  maxAttempts: row.maxAttempts,
  expiresAt: row.expiresAt,
  verifiedAt: row.verifiedAt,
  resetTokenHash: row.resetTokenHash,
  resetTokenExpiresAt: row.resetTokenExpiresAt,
  consumedAt: row.consumedAt,
});

@Injectable()
export class VerificationCodeTypeormRepository implements VerificationCodeRepositoryPort {
  constructor(
    @InjectRepository(VerificationCodeOrmEntity)
    private readonly repository: Repository<VerificationCodeOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async replaceOpen(code: NewVerificationCode, at: Date): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(VerificationCodeOrmEntity);
      await repository.update(
        {
          userId: code.userId,
          purpose: code.purpose,
          consumedAt: IsNull(),
          invalidatedAt: IsNull(),
        },
        { invalidatedAt: at },
      );
      await repository.insert(code);
    });
  }

  async findOpen(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationCode | null> {
    const row = await this.repository.findOne({
      where: { userId, purpose, consumedAt: IsNull(), invalidatedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
    return row ? toCode(row) : null;
  }

  async findByResetTokenHash(hash: string): Promise<VerificationCode | null> {
    const row = await this.repository.findOne({
      where: { resetTokenHash: hash, invalidatedAt: IsNull() },
    });
    return row ? toCode(row) : null;
  }

  countCreatedSince(
    userId: string,
    purpose: VerificationPurpose,
    since: Date,
  ): Promise<number> {
    return this.repository.count({
      where: { userId, purpose, createdAt: MoreThanOrEqual(since) },
    });
  }

  async update(
    id: string,
    patch: Parameters<VerificationCodeRepositoryPort["update"]>[1],
  ): Promise<void> {
    await this.repository.update({ id }, patch);
  }
}
