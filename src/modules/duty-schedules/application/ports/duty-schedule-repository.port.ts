import type {
  DutySchedule,
  DutyScheduleStatus,
} from "@/modules/duty-schedules/domain/duty-schedule";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type NewDutySchedule = Omit<
  DutySchedule,
  "id" | "status" | "cancellationReason" | "createdAt"
>;

export type DutyScheduleFilter = {
  /** Part of the title (accents ignored). */
  search?: string;
  status?: DutyScheduleStatus;
};

export interface DutyScheduleRepositoryPort {
  /** The batch, its days and its people, plus the notices, atomically. */
  create(
    data: NewDutySchedule,
    createdBy: string,
    notifications: readonly OutboxDraft[],
  ): Promise<DutySchedule>;
  /** Newest first. */
  page(
    filter: DutyScheduleFilter,
    page: PageRequest,
  ): Promise<Paginated<DutySchedule>>;
  findById(id: string): Promise<DutySchedule | null>;
  cancel(
    id: string,
    reason: string,
    notifications: readonly OutboxDraft[],
  ): Promise<DutySchedule>;
}

export const DUTY_SCHEDULE_REPOSITORY = Symbol("DUTY_SCHEDULE_REPOSITORY");
