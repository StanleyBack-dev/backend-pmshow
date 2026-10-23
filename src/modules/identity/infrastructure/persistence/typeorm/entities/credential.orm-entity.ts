import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("tb_auth_credentials")
export class CredentialOrmEntity {
  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ name: "must_change_password", type: "boolean", default: true })
  mustChangePassword!: boolean;

  @Column({ name: "failed_login_attempts", type: "int", default: 0 })
  failedLoginAttempts!: number;

  @Column({ name: "locked_until", type: "timestamptz", nullable: true })
  lockedUntil!: Date | null;

  @Column({ name: "password_changed_at", type: "timestamptz", nullable: true })
  passwordChangedAt!: Date | null;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
