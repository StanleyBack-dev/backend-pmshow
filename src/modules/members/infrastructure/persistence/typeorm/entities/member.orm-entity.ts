import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { MemberStatus, Rank, Section } from "@/modules/members/domain/member";

// FKs to tb_users live in the migration: this module does not map the
// identity module's entities.

@Entity("tb_members")
export class MemberOrmEntity {
  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ name: "war_name", type: "varchar", length: 60 })
  warName!: string;

  @Column({ type: "varchar", length: 24 })
  rank!: Rank;

  @Column({ type: "varchar", length: 20, nullable: true })
  registration!: string | null;

  @Column({ type: "varchar", length: 11, nullable: true })
  phone!: string | null;

  @Column({ type: "varchar", length: 16 })
  section!: Section;

  @Column({ type: "varchar", length: 16 })
  status!: MemberStatus;

  @Column({ type: "varchar", length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity("tb_instruments")
export class InstrumentOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_instruments" })
  id!: string;

  @Column({ type: "varchar", length: 60 })
  name!: string;

  @Column({ type: "varchar", length: 16 })
  section!: Section;

  @Column({ type: "boolean", default: false })
  archived!: boolean;
}

@Entity("tb_member_instruments")
export class MemberInstrumentOrmEntity {
  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @PrimaryColumn({ name: "idtb_instruments", type: "uuid" })
  instrumentId!: string;

  @Column({ name: "is_primary", type: "boolean", default: false })
  primary!: boolean;
}

@Entity("tb_member_functions")
export class MemberFunctionOrmEntity {
  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @PrimaryColumn({ name: "idtb_band_functions", type: "uuid" })
  functionId!: string;
}
