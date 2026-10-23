import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SongCategory } from "@/modules/repertoire/domain/song";

@Entity("tb_songs")
export class SongOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_songs" })
  id!: string;

  @Column({ type: "varchar", length: 160 })
  title!: string;

  @Column({ type: "varchar", length: 160, nullable: true })
  artist!: string | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  arranger!: string | null;

  @Column({ type: "varchar", length: 24 })
  category!: SongCategory;

  @Column({ name: "musical_key", type: "varchar", length: 4, nullable: true })
  musicalKey!: string | null;

  @Column({ type: "smallint", nullable: true })
  bpm!: number | null;

  @Column({ name: "duration_seconds", type: "int", nullable: true })
  durationSeconds!: number | null;

  @Column({ type: "text", nullable: true })
  lyrics!: string | null;

  @Column({ type: "varchar", length: 1000, nullable: true })
  notes!: string | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  tags!: string[];

  // Plain uuid, no FK: the song outlives the account that created it.
  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy!: string | null;

  @Column({ name: "archived_at", type: "timestamptz", nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
