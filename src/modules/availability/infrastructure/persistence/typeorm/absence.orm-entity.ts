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

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
