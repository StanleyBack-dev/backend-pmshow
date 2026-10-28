import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import type {
  SystemCategory,
  SystemLevel,
} from "@/common/logging/system-events";

@Entity("tb_system_logs")
export class SystemLogOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_system_logs" })
  id!: string;

  @Column({ type: "varchar", length: 10 })
  level!: SystemLevel;

  @Column({ type: "varchar", length: 12 })
  category!: SystemCategory;

  @Column({ type: "varchar", length: 200 })
  source!: string;

  @Column({ type: "varchar", length: 1000 })
  message!: string;

  @Column({ type: "jsonb", nullable: true })
  details!: Record<string, unknown> | null;

  @Column({ name: "idtb_users", type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip!: string | null;

  @Column({ name: "status_code", type: "int", nullable: true })
  statusCode!: number | null;

  @Column({ name: "duration_ms", type: "int", nullable: true })
  durationMs!: number | null;

  @Column({ type: "varchar", length: 20 })
  environment!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
