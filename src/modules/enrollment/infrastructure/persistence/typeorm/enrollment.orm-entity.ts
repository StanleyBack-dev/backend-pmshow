import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import type {
  EnrollmentInstrumentChoice,
  EnrollmentStatus,
} from "@/modules/enrollment/domain/enrollment";
import type { Rank } from "@/modules/members/domain/member";

@Entity("tb_enrollment_invites")
export class EnrollmentInviteOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_enrollment_invites" })
  id!: string;

  @Column({ type: "varchar", length: 6 })
  code!: string;

  @Column({ type: "varchar", length: 80 })
  label!: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt!: Date | null;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity("tb_enrollment_requests")
export class EnrollmentRequestOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_enrollment_requests" })
  id!: string;

  @Column({ name: "idtb_enrollment_invites", type: "uuid", nullable: true })
  inviteId!: string | null;

  @Column({ type: "varchar", length: 10 })
  status!: EnrollmentStatus;

  @Column({ name: "full_name", type: "varchar", length: 160 })
  fullName!: string;

  @Column({ type: "varchar", length: 254 })
  email!: string;

  @Column({ type: "varchar", length: 11 })
  phone!: string;

  @Column({ type: "boolean" })
  military!: boolean;

  @Column({ name: "military_id", type: "varchar", length: 5, nullable: true })
  militaryId!: string | null;

  @Column({ type: "varchar", length: 24 })
  rank!: Rank;

  @Column({ name: "war_name", type: "varchar", length: 60 })
  warName!: string;

  @Column({ type: "jsonb" })
  instruments!: EnrollmentInstrumentChoice[];

  @Column({ name: "consent_at", type: "timestamptz" })
  consentAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "reviewed_by", type: "uuid", nullable: true })
  reviewedBy!: string | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt!: Date | null;

  @Column({
    name: "rejection_reason",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  rejectionReason!: string | null;

  @Column({ name: "idtb_users", type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ name: "photo_key", type: "varchar", length: 200, nullable: true })
  photoKey!: string | null;
}
