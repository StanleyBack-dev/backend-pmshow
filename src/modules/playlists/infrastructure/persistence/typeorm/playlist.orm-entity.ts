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

// A line of the playlist: a song of the repertoire (idtb_songs) or a
// YouTube video kept only here (youtube_*); the table checks it is one of
// the two.
@Entity("tb_playlist_items")
export class PlaylistItemOrmEntity {
  @PrimaryColumn({ name: "idtb_playlists", type: "uuid" })
  playlistId!: string;

  @PrimaryColumn({ type: "int" })
  position!: number;

  @Column({ name: "idtb_songs", type: "uuid", nullable: true })
  songId!: string | null;

  @Column({
    name: "youtube_video_id",
    type: "varchar",
    length: 11,
    nullable: true,
  })
  videoId!: string | null;

  @Column({
    name: "youtube_title",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  videoTitle!: string | null;

  @Column({
    name: "youtube_channel",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  videoChannel!: string | null;
}
