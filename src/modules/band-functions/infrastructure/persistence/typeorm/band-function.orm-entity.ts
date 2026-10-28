import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("tb_band_functions")
export class BandFunctionOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_band_functions" })
  id!: string;

  @Column({ type: "varchar", length: 60 })
  name!: string;

  @Column({ type: "boolean", default: false })
  archived!: boolean;
}
