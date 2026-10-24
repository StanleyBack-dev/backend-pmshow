import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  AckStatus,
  AssignmentRole,
  RosterStatus,
} from "@/modules/rosters/domain/roster";

// One roster per event: the event id is the key (FK in the migration).
@Entity("tb_rosters")
export class RosterOrmEntity {
  @PrimaryColumn({ name: "idtb_events", type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar", length: 10 })
  status!: RosterStatus;

  @Column({ type: "int", default: 0 })
  version!: number;

  @Column({ name: "published_at", type: "timestamptz", nullable: true })
  publishedAt!: Date | null;

  @Column({ name: "published_by", type: "uuid", nullable: true })
  publishedBy!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity("tb_roster_assignments")
export class RosterAssignmentOrmEntity {
  @PrimaryColumn({ name: "idtb_events", type: "uuid" })
  eventId!: string;

  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 16 })
  role!: AssignmentRole;

  @Column({ name: "idtb_instruments", type: "uuid", nullable: true })
  instrumentId!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  notes!: string | null;

  @Column({
    name: "override_reason",
    type: "varchar",
    length: 300,
    nullable: true,
  })
  overrideReason!: string | null;

  @Column({ name: "ack_status", type: "varchar", length: 16 })
  ackStatus!: AckStatus;

  @Column({ name: "ack_note", type: "varchar", length: 300, nullable: true })
  ackNote!: string | null;

  @Column({ name: "ack_at", type: "timestamptz", nullable: true })
  ackAt!: Date | null;
}
