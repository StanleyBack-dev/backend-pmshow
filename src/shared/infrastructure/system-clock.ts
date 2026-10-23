import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import {
  startOfLocalDate,
  startOfNextLocalDay,
  toLocalDate,
} from "@/shared/domain/local-date";

@Injectable()
export class SystemClock implements ClockPort {
  private readonly timeZone: string;

  constructor(config: ConfigService) {
    this.timeZone = config.get<string>("APP_TIMEZONE") ?? "America/Sao_Paulo";
  }

  now(): Date {
    return new Date();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  localDate(date: Date = this.now()): string {
    return toLocalDate(date, this.timeZone);
  }

  startOfNextLocalDay(date: Date = this.now()): Date {
    return startOfNextLocalDay(date, this.timeZone);
  }

  startOfLocalDate(localDate: string): Date {
    return startOfLocalDate(localDate, this.timeZone);
  }
}
