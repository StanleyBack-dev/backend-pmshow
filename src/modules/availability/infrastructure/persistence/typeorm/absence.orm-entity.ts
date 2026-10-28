import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import {
  AbsenceStatus,
  AbsenceType,
} from "@/modules/availability/domain/absence";

@Entity("tb_absences")
@Index(["userId", "startsOn"])
export class AbsenceOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_absences" })
  id!: string;

  @Column({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 20 })
  type!: AbsenceType;

  @Column({ name: "starts_on", type: "date" })
  startsOn!: string;

  @Column({ name: "ends_on", type: "date" })
  endsOn!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  reason!: string | null;

  @Column({ type: "varchar", length: 10 })
  status!: AbsenceStatus;

  @Column({ name: "review_note", type: "varchar", length: 500, nullable: true })
  reviewNote!: string | null;

  @Column({ name: "reviewed_by", type: "uuid", nullable: true })
  reviewedBy!: string | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: "cancelled_by", type: "uuid", nullable: true })
  cancelledBy!: string | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity("tb_absence_attachments")
export class AbsenceAttachmentOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_absence_attachments" })
  id!: string;

  @Column({ name: "idtb_absences", type: "uuid" })
  absenceId!: string;

  @Column({ name: "storage_key", type: "varchar", length: 300 })
  storageKey!: string;

  @Column({ name: "file_name", type: "varchar", length: 160 })
  fileName!: string;

  @Column({ name: "mime_type", type: "varchar", length: 60 })
  mimeType!: string;

  @Column({ name: "size_bytes", type: "int" })
  sizeBytes!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
