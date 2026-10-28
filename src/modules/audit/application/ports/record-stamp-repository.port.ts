import type {
  RecordStamp,
  StampedEntity,
  StampInput,
} from "@/modules/audit/domain/record-stamp";

export interface RecordStampRepositoryPort {
  /** Sets updated_by/updated_at (and created_by when created). */
  stamp(input: StampInput): Promise<void>;
  /** The same stamp on many records of one table, in one statement. */
  stampMany(
    input: Omit<StampInput, "entityId"> & { entityIds: readonly string[] },
  ): Promise<void>;
  /** The record's stamps with the people's names; null if it doesn't exist. */
  find(entity: StampedEntity, id: string): Promise<RecordStamp | null>;
}

export const RECORD_STAMP_REPOSITORY = Symbol("RECORD_STAMP_REPOSITORY");
