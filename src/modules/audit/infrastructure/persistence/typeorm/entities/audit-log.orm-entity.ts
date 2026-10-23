import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("tb_audit_logs")
@Index(["entity", "entityId"])
@Index(["createdAt"])
export class AuditLogOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_audit_logs" })
  id!: string;

  // No FK: the trail must outlive the user who acted.
  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actorId!: string | null;

  @Column({ type: "varchar", length: 64 })
  action!: string;

  @Column({ type: "varchar", length: 64 })
  entity!: string;

  @Column({ name: "entity_id", type: "varchar", length: 64, nullable: true })
  entityId!: string | null;

  @Column({ type: "jsonb", nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  after!: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
