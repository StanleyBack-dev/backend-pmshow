import type {
  EnrollmentData,
  EnrollmentInvite,
  EnrollmentRequest,
  EnrollmentStatus,
} from "@/modules/enrollment/domain/enrollment";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type EnrollmentRequestFilter = {
  status?: EnrollmentStatus;
  /** Name, war name, RG or e-mail. */
  search?: string;
};

export interface EnrollmentRepositoryPort {
  // === invites ===
  /** Most recent first. */
  listInvites(limit: number): Promise<EnrollmentInvite[]>;
  findInvite(id: string): Promise<EnrollmentInvite | null>;
  /** The open invite (not revoked, not expired) holding this code. */
  findOpenInviteByCode(
    code: string,
    now: Date,
  ): Promise<EnrollmentInvite | null>;
  createInvite(data: {
    code: string;
    label: string;
    expiresAt: Date;
    createdBy: string;
  }): Promise<EnrollmentInvite>;
  revokeInvite(id: string, at: Date): Promise<EnrollmentInvite>;

  // === requests ===
  pageRequests(
    filter: EnrollmentRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<EnrollmentRequest>>;
  findRequest(id: string): Promise<EnrollmentRequest | null>;
  /** A pending request with this RG or e-mail (to avoid duplicates). */
  findPending(input: {
    email: string;
    militaryId: string | null;
  }): Promise<EnrollmentRequest | null>;
  countPending(): Promise<number>;
  /** Stores the request and its notices (outbox) in one transaction. */
  createRequest(
    data: EnrollmentData & {
      inviteId: string;
      consentAt: Date;
      photoKey: string | null;
    },
    notices: (requestId: string) => OutboxDraft[],
  ): Promise<EnrollmentRequest>;
  /** Corrected data and/or the review outcome. */
  updateRequest(
    id: string,
    patch: Partial<EnrollmentData> & {
      status?: EnrollmentStatus;
      reviewedBy?: string;
      reviewedAt?: Date;
      rejectionReason?: string | null;
      userId?: string;
      photoKey?: string | null;
    },
  ): Promise<EnrollmentRequest>;
}

export const ENROLLMENT_REPOSITORY = Symbol("ENROLLMENT_REPOSITORY");
