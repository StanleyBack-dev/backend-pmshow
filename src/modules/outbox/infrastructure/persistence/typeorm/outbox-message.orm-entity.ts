import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OutboxStatus } from "@/modules/outbox/domain/outbox";

@Entity("tb_outbox")
export class OutboxMessageOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_outbox" })
  id!: string;

  @Column({ type: "varchar", length: 60 })
  topic!: string;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ name: "dedupe_key", type: "varchar", length: 200, nullable: true })
  dedupeKey!: string | null;

  @Column({ type: "varchar", length: 8, default: OutboxStatus.PENDING })
  status!: OutboxStatus;

  @Column({ type: "smallint", default: 0 })
  attempts!: number;

  @Column({
    name: "next_attempt_at",
    type: "timestamptz",
    default: () => "now()",
  })
  nextAttemptAt!: Date;

  @Column({ name: "locked_until", type: "timestamptz", nullable: true })
  lockedUntil!: Date | null;

  @Column({ name: "last_error", type: "varchar", length: 1000, nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "processed_at", type: "timestamptz", nullable: true })
  processedAt!: Date | null;
}
