import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  EventStatus,
  EventType,
  EventUniform,
} from "@/modules/events/domain/event";

@Entity("tb_venues")
export class VenueOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_venues" })
  id!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ name: "zip_code", type: "varchar", length: 8, nullable: true })
  zipCode!: string | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  street!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  number!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  complement!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  district!: string | null;

  @Column({ type: "varchar", length: 80 })
  city!: string;

  @Column({ type: "varchar", length: 2, default: "GO" })
  state!: string;

  @Column({ name: "maps_url", type: "varchar", length: 500, nullable: true })
  mapsUrl!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  notes!: string | null;

  @Column({ type: "boolean", default: false })
  archived!: boolean;
}

@Entity("tb_events")
@Index(["startsAt"])
export class EventOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_events" })
  id!: string;

  @Column({ type: "varchar", length: 160 })
  title!: string;

  @Column({ type: "varchar", length: 16 })
  type!: EventType;

  @Column({ type: "varchar", length: 12 })
  status!: EventStatus;

  @Column({ name: "call_time", type: "timestamptz", nullable: true })
  callTime!: Date | null;

  @Column({ name: "starts_at", type: "timestamptz" })
  startsAt!: Date;

  @Column({ name: "ends_at", type: "timestamptz", nullable: true })
  endsAt!: Date | null;

  // FK to tb_venues lives in the migration.
  @Column({ name: "idtb_venues", type: "uuid", nullable: true })
  venueId!: string | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  uniform!: EventUniform | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  requester!: string | null;

  @Column({ name: "document_ref", type: "varchar", length: 80, nullable: true })
  documentRef!: string | null;

  @Column({ type: "varchar", length: 2000, nullable: true })
  notes!: string | null;

  @Column({
    name: "cancellation_reason",
    type: "varchar",
    length: 500,
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

@Entity("tb_event_songs")
export class EventSongOrmEntity {
  @PrimaryColumn({ name: "idtb_events", type: "uuid" })
  eventId!: string;

  @PrimaryColumn({ name: "idtb_songs", type: "uuid" })
  songId!: string;

  @Column({ type: "smallint" })
  position!: number;

  @Column({ type: "varchar", length: 200, nullable: true })
  notes!: string | null;
}
