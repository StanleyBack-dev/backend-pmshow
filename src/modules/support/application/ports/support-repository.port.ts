import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type {
  SupportCategory,
  SupportRequest,
  SupportStatus,
} from "@/modules/support/domain/support-request";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** The request with the names the screens show. */
export type SupportRequestView = SupportRequest & {
  userName: string;
  warName: string | null;
  repliedByName: string | null;
  finalizedByName: string | null;
};

export type SupportFilter = {
  /** Only this person's requests ("Minhas"). */
  userId?: string;
  status?: SupportStatus;
};

export type NewSupportRequest = {
  userId: string;
  category: SupportCategory;
  subject: string;
  message: string;
};

export interface SupportRepositoryPort {
  /**
   * Stores the request and its notices in one transaction; the notices need
   * the protocol number, known only after the insert.
   */
  create(
    request: NewSupportRequest,
    notices: (saved: SupportRequest) => OutboxDraft[],
  ): Promise<SupportRequestView>;
  /** How many requests the person sent from `since` on. */
  countSince(userId: string, since: Date): Promise<number>;
  findById(id: string): Promise<SupportRequestView | null>;
  /** Most recent first. */
  list(
    filter: SupportFilter,
    page: PageRequest,
  ): Promise<Paginated<SupportRequestView>>;
  /** Status change (reply or closing) plus its notices, in one transaction. */
  update(
    id: string,
    change: Partial<
      Pick<
        SupportRequest,
        | "status"
        | "reply"
        | "repliedAt"
        | "repliedBy"
        | "finalizedAt"
        | "finalizedBy"
      >
    >,
    notices: readonly OutboxDraft[],
  ): Promise<SupportRequestView>;
}

export const SUPPORT_REPOSITORY = Symbol("SUPPORT_REPOSITORY");
