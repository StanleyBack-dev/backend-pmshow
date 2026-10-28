import type {
  Absence,
  AbsenceStatus,
  Period,
} from "@/modules/availability/domain/absence";
import type { AbsenceAttachment } from "@/modules/availability/domain/absence-attachment";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

/** An absence plus who it is for and its files, as lists show it. */
export type AbsenceView = Absence & {
  userName: string;
  warName: string | null;
  /** "Full name (war name)" of who reviewed / cancelled it. */
  reviewedByName: string | null;
  cancelledByName: string | null;
  /** Registered by a manager for the member (already approved). */
  registered: boolean;
  attachments: AbsenceAttachment[];
};

export type NewAttachment = Omit<AbsenceAttachment, "id" | "absenceId">;

export type AbsenceFilter = {
  userIds?: readonly string[];
  statuses?: AbsenceStatus[];
  /** Absences touching this period. */
  period?: Period;
};

export type NewAbsence = Omit<
  Absence,
  "id" | "createdAt" | "cancelledBy" | "cancelledAt"
>;

export interface AbsenceRepositoryPort {
  /** Most recent start first; capped at `limit`. */
  list(filter: AbsenceFilter, limit: number): Promise<AbsenceView[]>;
  findById(id: string): Promise<AbsenceView | null>;
  /** The absence, its files and its notifications, in one transaction. */
  create(
    absence: NewAbsence,
    notifications?: readonly OutboxDraft[],
    attachments?: readonly NewAttachment[],
  ): Promise<AbsenceView>;
  /** One attached file, with whose absence it belongs to. */
  findAttachment(
    id: string,
  ): Promise<(AbsenceAttachment & { userId: string }) | null>;
  /** Status change plus its notifications, in one transaction. */
  setStatus(
    id: string,
    change: {
      status: AbsenceStatus;
      reviewedBy?: string;
      reviewedAt?: Date;
      reviewNote?: string | null;
      cancelledBy?: string;
      cancelledAt?: Date;
    },
    notifications: readonly OutboxDraft[],
  ): Promise<AbsenceView>;
}

export const ABSENCE_REPOSITORY = Symbol("ABSENCE_REPOSITORY");
