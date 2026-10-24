import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BroadcastAudience } from "@/modules/broadcasts/domain/broadcast";
import type { Section } from "@/modules/members/domain/member";

@Entity("tb_broadcasts")
export class BroadcastOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_broadcasts" })
  id!: string;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ type: "varchar", length: 2000 })
  body!: string;

  @Column({ type: "varchar", length: 16 })
  audience!: BroadcastAudience;

  @Column({ type: "varchar", length: 16, nullable: true })
  section!: Section | null;

  @Column({ name: "idtb_events", type: "uuid", nullable: true })
  eventId!: string | null;

  @Column({ name: "send_email", type: "boolean" })
  sendEmail!: boolean;

  @Column({ type: "int" })
  recipients!: number;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
