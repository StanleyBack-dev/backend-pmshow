import type {
  SystemCategory,
  SystemLevel,
} from "@/common/logging/system-events";
import type { SystemLog } from "@/modules/system-logs/domain/system-log";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type SystemLogFilter = {
  from?: Date;
  to?: Date;
  levels?: SystemLevel[];
  categories?: SystemCategory[];
  /** Part of the message or the source. */
  search?: string;
  environment?: string;
};

export type SystemLogView = SystemLog & { userName: string | null };

export type SystemLogSummary = {
  level: SystemLevel;
  last24h: number;
  last7d: number;
};

export interface SystemLogRepositoryPort {
  insert(log: Omit<SystemLog, "id" | "createdAt">): Promise<void>;
  /** Most recent first. */
  page(
    filter: SystemLogFilter,
    page: PageRequest,
  ): Promise<Paginated<SystemLogView>>;
  summary(now: Date): Promise<SystemLogSummary[]>;
  purgeBefore(before: Date): Promise<number>;
}

export const SYSTEM_LOG_REPOSITORY = Symbol("SYSTEM_LOG_REPOSITORY");
