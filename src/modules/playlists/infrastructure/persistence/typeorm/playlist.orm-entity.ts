import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("tb_playlists")
export class PlaylistOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_playlists" })
  id!: string;

  @Column({ name: "owner_id", type: "uuid" })
  ownerId!: string;

  @Column({ type: "varchar", length: 80 })
  name!: string;

  @Column({ type: "varchar", length: 300, nullable: true })
  description!: string | null;

  @Column({ type: "boolean", default: false })
  shared!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity("tb_playlist_songs")
export class PlaylistSongOrmEntity {
  @PrimaryColumn({ name: "idtb_playlists", type: "uuid" })
  playlistId!: string;

  @PrimaryColumn({ type: "int" })
  position!: number;

  @Column({ name: "idtb_songs", type: "uuid" })
  songId!: string;
}
