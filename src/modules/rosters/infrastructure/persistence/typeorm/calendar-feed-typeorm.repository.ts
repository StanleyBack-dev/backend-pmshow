import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type {
  CalendarFeed,
  CalendarFeedRepositoryPort,
} from "@/modules/rosters/application/ports/calendar-feed-repository.port";
import { CalendarFeedOrmEntity } from "@/modules/rosters/infrastructure/persistence/typeorm/calendar-feed.orm-entity";

@Injectable()
export class CalendarFeedTypeormRepository implements CalendarFeedRepositoryPort {
  constructor(
    @InjectRepository(CalendarFeedOrmEntity)
    private readonly feeds: Repository<CalendarFeedOrmEntity>,
  ) {}

  findByUser(userId: string): Promise<CalendarFeed | null> {
    return this.feeds.findOne({ where: { userId } });
  }

  findByToken(token: string): Promise<CalendarFeed | null> {
    return this.feeds.findOne({ where: { token } });
  }

  async save(userId: string, token: string): Promise<CalendarFeed> {
    await this.feeds.delete({ userId });
    return this.feeds.save(this.feeds.create({ userId, token }));
  }

  async remove(userId: string): Promise<void> {
    await this.feeds.delete({ userId });
  }
}
