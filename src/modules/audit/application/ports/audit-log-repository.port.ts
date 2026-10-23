import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type AuditEntryInput = {
  actorId: string | null;
  /** Dotted verb, e.g. "user.created", "user.permissions_changed". */
  action: string;
  entity: string;
  entityId: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
};

export type AuditEntry = Required<AuditEntryInput> & {
  id: string;
  actorName: string | null;
  createdAt: Date;
};

export type AuditFilter = {
  entity?: string;
  entityId?: string;
  actorId?: string;
};

export interface AuditLogRepositoryPort {
  append(entry: AuditEntryInput): Promise<void>;
  list(filter: AuditFilter, page: PageRequest): Promise<Paginated<AuditEntry>>;
}

export const AUDIT_LOG_REPOSITORY = Symbol("AUDIT_LOG_REPOSITORY");
