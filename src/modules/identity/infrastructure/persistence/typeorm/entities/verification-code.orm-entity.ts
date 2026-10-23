import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { VerificationPurpose } from "@/modules/identity/application/ports/verification-code-repository.port";

@Entity("tb_auth_verification_codes")
@Index(["userId", "purpose", "createdAt"])
export class VerificationCodeOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_auth_verification_codes" })
  id!: string;

  @Column({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 32 })
  purpose!: VerificationPurpose;

  @Column({ name: "code_hash", type: "varchar", length: 128 })
  codeHash!: string;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ name: "max_attempts", type: "int" })
  maxAttempts!: number;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt!: Date | null;

  @Index({ unique: true, where: '"reset_token_hash" IS NOT NULL' })
  @Column({
    name: "reset_token_hash",
    type: "varchar",
    length: 128,
    nullable: true,
  })
  resetTokenHash!: string | null;

  @Column({
    name: "reset_token_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  resetTokenExpiresAt!: Date | null;

  @Column({ name: "consumed_at", type: "timestamptz", nullable: true })
  consumedAt!: Date | null;

  @Column({ name: "invalidated_at", type: "timestamptz", nullable: true })
  invalidatedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
