import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("tb_artists")
export class ArtistOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_artists" })
  id!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  /** Name without accents or case (unique), see artistKey. */
  @Column({ name: "name_key", type: "varchar", length: 120, unique: true })
  nameKey!: string;

  @Column({ type: "boolean", default: false })
  archived!: boolean;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
