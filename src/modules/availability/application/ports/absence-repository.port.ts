import type {
  Absence,
  AbsenceStatus,
  Period,
} from "@/modules/availability/domain/absence";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

/** An absence plus who it is for, as lists show it. */
export type AbsenceView = Absence & {
  userName: string;
  warName: string | null;
};

export type AbsenceFilter = {
  userIds?: readonly string[];
  statuses?: AbsenceStatus[];
  /** Absences touching this period. */
  period?: Period;
};

export type NewAbsence = Omit<Absence, "id" | "createdAt">;

export interface AbsenceRepositoryPort {
  /** Most recent start first; capped at `limit`. */
  list(filter: AbsenceFilter, limit: number): Promise<AbsenceView[]>;
  findById(id: string): Promise<AbsenceView | null>;
  create(absence: NewAbsence): Promise<AbsenceView>;
  /** Status change plus its notifications, in one transaction. */
  setStatus(
    id: string,
    change: {
      status: AbsenceStatus;
      reviewedBy?: string;
      reviewedAt?: Date;
      reviewNote?: string | null;
    },
    notifications: readonly OutboxDraft[],
  ): Promise<AbsenceView>;
}

export const ABSENCE_REPOSITORY = Symbol("ABSENCE_REPOSITORY");
