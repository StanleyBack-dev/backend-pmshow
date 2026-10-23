import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";
import { MediaKind, MediaStatus } from "@/modules/media/domain/media";

// FK to tb_songs (ON DELETE CASCADE) lives in the migration.
@Entity("tb_media_assets")
@Index(["songId", "status"])
export class MediaAssetOrmEntity {
  @PrimaryColumn({ name: "idtb_media_assets", type: "uuid" })
  id!: string;

  @Column({ name: "idtb_songs", type: "uuid" })
  songId!: string;

  @Column({ type: "varchar", length: 8 })
  kind!: MediaKind;

  @Column({ type: "varchar", length: 8 })
  status!: MediaStatus;

  @Column({ type: "varchar", length: 160 })
  title!: string;

  @Column({ name: "storage_key", type: "varchar", length: 255, nullable: true })
  storageKey!: string | null;

  @Column({ name: "mime_type", type: "varchar", length: 64, nullable: true })
  mimeType!: string | null;

  @Column({
    name: "size_bytes",
    type: "bigint",
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  sizeBytes!: number | null;

  @Column({ name: "duration_seconds", type: "int", nullable: true })
  durationSeconds!: number | null;

  @Column({
    name: "youtube_video_id",
    type: "varchar",
    length: 11,
    nullable: true,
  })
  youtubeVideoId!: string | null;

  @Column({
    name: "thumbnail_url",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  thumbnailUrl!: string | null;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
