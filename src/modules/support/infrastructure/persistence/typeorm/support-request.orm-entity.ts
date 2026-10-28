import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  SupportCategory,
  SupportStatus,
} from "@/modules/support/domain/support-request";

@Entity("tb_support_requests")
@Index(["userId", "createdAt"])
export class SupportRequestOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_support_requests" })
  id!: string;

  @Column({ type: "int", insert: false, update: false })
  @Generated("increment")
  protocol!: number;

  @Column({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 16 })
  category!: SupportCategory;

  @Column({ type: "varchar", length: 120 })
  subject!: string;

  @Column({ type: "varchar", length: 2000 })
  message!: string;

  @Column({ type: "varchar", length: 12, default: SupportStatus.ABERTO })
  status!: SupportStatus;

  @Column({ type: "varchar", length: 2000, nullable: true })
  reply!: string | null;

  @Column({ name: "replied_at", type: "timestamptz", nullable: true })
  repliedAt!: Date | null;

  @Column({ name: "replied_by", type: "uuid", nullable: true })
  repliedBy!: string | null;

  @Column({ name: "finalized_at", type: "timestamptz", nullable: true })
  finalizedAt!: Date | null;

  @Column({ name: "finalized_by", type: "uuid", nullable: true })
  finalizedBy!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
