import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type {
  DutyAudienceKind,
  DutyScheduleStatus,
} from "@/modules/duty-schedules/domain/duty-schedule";
import type { EventUniform } from "@/modules/events/domain/event";
import type { Section } from "@/modules/members/domain/member";

// FKs to tb_events, tb_venues and tb_users live in the migration.

@Entity("tb_duty_schedules")
export class DutyScheduleOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_duty_schedules" })
  id!: string;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ name: "starts_on", type: "date" })
  startsOn!: string;

  @Column({ name: "ends_on", type: "date" })
  endsOn!: string;

  @Column({ name: "idtb_venues", type: "uuid" })
  venueId!: string;

  @Column({ type: "varchar", length: 24 })
  uniform!: EventUniform;

  @Column({ type: "varchar", length: 1000, nullable: true })
  notes!: string | null;

  @Column({ name: "audience_kind", type: "varchar", length: 10 })
  audienceKind!: DutyAudienceKind;

  @Column({ type: "jsonb", default: () => "'[]'" })
  sections!: Section[];

  @Column({ type: "varchar", length: 10 })
  status!: DutyScheduleStatus;

  @Column({
    name: "cancellation_reason",
    type: "varchar",
    length: 300,
    nullable: true,
  })
  cancellationReason!: string | null;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity("tb_duty_schedule_events")
export class DutyScheduleEventOrmEntity {
  @PrimaryColumn({ name: "idtb_duty_schedules", type: "uuid" })
  scheduleId!: string;

  @PrimaryColumn({ name: "idtb_events", type: "uuid" })
  eventId!: string;
}

@Entity("tb_duty_schedule_members")
export class DutyScheduleMemberOrmEntity {
  @PrimaryColumn({ name: "idtb_duty_schedules", type: "uuid" })
  scheduleId!: string;

  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;
}
