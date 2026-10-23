import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, type Repository } from "typeorm";
import type {
  NewSession,
  Session,
  SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import { SessionOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/session.orm-entity";

@Injectable()
export class SessionTypeormRepository implements SessionRepositoryPort {
  constructor(
    @InjectRepository(SessionOrmEntity)
    private readonly repository: Repository<SessionOrmEntity>,
  ) {}

  async create(session: NewSession): Promise<void> {
    await this.repository.insert({ ...session, lastUsedAt: new Date() });
  }

  async findById(id: string): Promise<Session | null> {
    const row = await this.repository.findOne({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      refreshSecretHash: row.refreshSecretHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      lastUsedAt: row.lastUsedAt,
    };
  }

  async touch(id: string, expiresAt: Date, usedAt: Date): Promise<void> {
    await this.repository.update(
      { id, revokedAt: IsNull() },
      { expiresAt, lastUsedAt: usedAt },
    );
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.repository.update(
      { id, revokedAt: IsNull() },
      { revokedAt: at },
    );
  }

  async revokeAllForUser(
    userId: string,
    at: Date,
    exceptSessionId?: string,
  ): Promise<void> {
    await this.repository.update(
      {
        userId,
        revokedAt: IsNull(),
        ...(exceptSessionId ? { id: Not(exceptSessionId) } : {}),
      },
      { revokedAt: at },
    );
  }
}
