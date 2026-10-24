import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, LessThan, type Repository } from "typeorm";
import type {
  NewNotification,
  NotificationRepositoryPort,
} from "@/modules/notifications/application/ports/notification-repository.port";
import type {
  Notification,
  NotificationType,
} from "@/modules/notifications/domain/notification";
import {
  NotificationOrmEntity,
  NotificationPrefOrmEntity,
} from "@/modules/notifications/infrastructure/persistence/typeorm/notification.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const toNotification = (row: NotificationOrmEntity): Notification => ({
  id: row.id,
  userId: row.userId,
  type: row.type,
  title: row.title,
  body: row.body,
  link: row.link,
  readAt: row.readAt,
  createdAt: row.createdAt,
});

@Injectable()
export class NotificationTypeormRepository implements NotificationRepositoryPort {
  constructor(
    @InjectRepository(NotificationOrmEntity)
    private readonly notifications: Repository<NotificationOrmEntity>,
    @InjectRepository(NotificationPrefOrmEntity)
    private readonly prefs: Repository<NotificationPrefOrmEntity>,
  ) {}

  async createOnce(
    sourceId: string,
    notification: NewNotification,
  ): Promise<void> {
    await this.notifications
      .createQueryBuilder()
      .insert()
      .values({ ...notification, sourceId })
      .orIgnore()
      .execute();
  }

  async list(
    userId: string,
    unreadOnly: boolean,
    page: PageRequest,
  ): Promise<Paginated<Notification>> {
    const [rows, total] = await this.notifications.findAndCount({
      where: { userId, ...(unreadOnly ? { readAt: IsNull() } : {}) },
      order: { createdAt: "DESC" },
      skip: (page.page - 1) * page.limit,
      take: page.limit,
    });
    return paginate(rows.map(toNotification), total, page);
  }

  countUnread(userId: string): Promise<number> {
    return this.notifications.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string, at: Date): Promise<boolean> {
    const row = await this.notifications.findOne({ where: { id, userId } });
    if (!row) return false;
    if (!row.readAt) await this.notifications.update({ id }, { readAt: at });
    return true;
  }

  async markAllRead(userId: string, at: Date): Promise<number> {
    const result = await this.notifications.update(
      { userId, readAt: IsNull() },
      { readAt: at },
    );
    return result.affected ?? 0;
  }

  async purgeReadBefore(before: Date): Promise<number> {
    const result = await this.notifications.delete({
      readAt: LessThan(before),
    });
    return result.affected ?? 0;
  }

  async emailOverrides(
    userId: string,
  ): Promise<Map<NotificationType, boolean>> {
    const rows = await this.prefs.find({ where: { userId } });
    return new Map(rows.map((row) => [row.type, row.emailEnabled]));
  }

  async setEmailOverride(
    userId: string,
    type: NotificationType,
    enabled: boolean | null,
  ): Promise<void> {
    if (enabled === null) {
      await this.prefs.delete({ userId, type });
      return;
    }
    await this.prefs.upsert({ userId, type, emailEnabled: enabled }, [
      "userId",
      "type",
    ]);
  }
}
