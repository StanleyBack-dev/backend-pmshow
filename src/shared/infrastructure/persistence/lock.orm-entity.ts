import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("tb_locks")
export class LockOrmEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  name!: string;

  @Column({ type: "varchar", length: 64 })
  holder!: string;

  @Column({ name: "lease_until", type: "timestamptz" })
  leaseUntil!: Date;
}
