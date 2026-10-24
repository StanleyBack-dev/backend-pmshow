import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type {
  PushSubscriptionData,
  PushSubscriptionRepositoryPort,
} from "@/modules/notifications/application/ports/push.ports";
import { PushSubscriptionOrmEntity } from "@/modules/notifications/infrastructure/persistence/typeorm/push-subscription.orm-entity";

@Injectable()
export class PushSubscriptionTypeormRepository implements PushSubscriptionRepositoryPort {
  constructor(
    @InjectRepository(PushSubscriptionOrmEntity)
    private readonly repository: Repository<PushSubscriptionOrmEntity>,
  ) {}

  async save(
    userId: string,
    subscription: PushSubscriptionData,
    userAgent: string | null,
  ): Promise<void> {
    await this.repository.upsert({ userId, ...subscription, userAgent }, [
      "endpoint",
    ]);
  }

  async listFor(userId: string): Promise<PushSubscriptionData[]> {
    const rows = await this.repository.find({ where: { userId } });
    return rows.map(({ endpoint, p256dh, auth }) => ({
      endpoint,
      p256dh,
      auth,
    }));
  }

  async remove(endpoint: string, userId?: string): Promise<boolean> {
    const result = await this.repository.delete(
      userId ? { endpoint, userId } : { endpoint },
    );
    return (result.affected ?? 0) > 0;
  }

  async touch(endpoint: string, at: Date): Promise<void> {
    await this.repository.update({ endpoint }, { lastUsedAt: at });
  }
}
