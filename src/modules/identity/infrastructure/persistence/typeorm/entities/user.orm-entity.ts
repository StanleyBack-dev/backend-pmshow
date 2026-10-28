import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserGroup } from "@/modules/access-control/domain/user-group";

@Entity("tb_users")
export class UserOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_users" })
  id!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  // Unique (case-insensitive) via the migration's index on lower(email).
  @Column({ type: "varchar", length: 254 })
  email!: string;

  @Column({ type: "varchar", length: 32, unique: true })
  username!: string;

  @Column({ type: "varchar", length: 16 })
  group!: UserGroup;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "deactivated_at", type: "timestamptz", nullable: true })
  deactivatedAt!: Date | null;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: "avatar_key", type: "varchar", length: 200, nullable: true })
  avatarKey!: string | null;

  @Column({
    name: "onboarding_completed_at",
    type: "timestamptz",
    nullable: true,
  })
  onboardingCompletedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
