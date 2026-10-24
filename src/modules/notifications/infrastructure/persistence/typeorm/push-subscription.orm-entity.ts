import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("tb_push_subscriptions")
export class PushSubscriptionOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_push_subscriptions" })
  id!: string;

  @Index()
  @Column({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 1000, unique: true })
  endpoint!: string;

  @Column({ type: "varchar", length: 200 })
  p256dh!: string;

  @Column({ type: "varchar", length: 100 })
  auth!: string;

  @Column({ name: "user_agent", type: "varchar", length: 300, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "last_used_at", type: "timestamptz", nullable: true })
  lastUsedAt!: Date | null;
}
