import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { NotificationType } from "@/modules/notifications/domain/notification";

@Entity("tb_notifications")
@Index(["userId", "createdAt"])
export class NotificationOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_notifications" })
  id!: string;

  @Column({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 32 })
  type!: NotificationType;

  @Column({ type: "varchar", length: 160 })
  title!: string;

  @Column({ type: "varchar", length: 1000 })
  body!: string;

  @Column({ type: "varchar", length: 300, nullable: true })
  link!: string | null;

  /** Outbox message that produced it (unique: delivery is idempotent). */
  @Column({ name: "source_id", type: "uuid", nullable: true, unique: true })
  sourceId!: string | null;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity("tb_notification_prefs")
export class NotificationPrefOrmEntity {
  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @PrimaryColumn({ type: "varchar", length: 32 })
  type!: NotificationType;

  @Column({ name: "email_enabled", type: "boolean" })
  emailEnabled!: boolean;
}
