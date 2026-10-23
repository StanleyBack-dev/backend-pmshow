import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { LessThan, type Repository } from "typeorm";
import type {
  MediaAssetRepositoryPort,
  NewMediaAsset,
} from "@/modules/media/application/ports/media.ports";
import {
  MediaKind,
  MediaStatus,
  type MediaAsset,
} from "@/modules/media/domain/media";
import { MediaAssetOrmEntity } from "@/modules/media/infrastructure/persistence/typeorm/media-asset.orm-entity";

const toAsset = (row: MediaAssetOrmEntity): MediaAsset => ({
  id: row.id,
  songId: row.songId,
  kind: row.kind,
  status: row.status,
  title: row.title,
  storageKey: row.storageKey,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  durationSeconds: row.durationSeconds,
  youtubeVideoId: row.youtubeVideoId,
  thumbnailUrl: row.thumbnailUrl,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

@Injectable()
export class MediaAssetTypeormRepository implements MediaAssetRepositoryPort {
  constructor(
    @InjectRepository(MediaAssetOrmEntity)
    private readonly repository: Repository<MediaAssetOrmEntity>,
  ) {}

  async listBySong(songId: string, status: MediaStatus): Promise<MediaAsset[]> {
    const rows = await this.repository.find({
      where: { songId, status },
      // Audio before video, then in the order they were added.
      order: { kind: "ASC", createdAt: "ASC" },
    });
    return rows.map(toAsset);
  }

  async findById(id: string): Promise<MediaAsset | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toAsset(row) : null;
  }

  async findVideo(
    songId: string,
    youtubeVideoId: string,
  ): Promise<MediaAsset | null> {
    const row = await this.repository.findOne({
      where: { songId, youtubeVideoId, kind: MediaKind.VIDEO },
    });
    return row ? toAsset(row) : null;
  }

  async create(asset: NewMediaAsset): Promise<MediaAsset> {
    const saved = await this.repository.save(
      this.repository.create({ ...asset, id: asset.id ?? randomUUID() }),
    );
    return toAsset(saved);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<MediaAsset, "status" | "title" | "sizeBytes" | "durationSeconds">
    >,
  ): Promise<MediaAsset> {
    await this.repository.update({ id }, patch);
    return toAsset(await this.repository.findOneOrFail({ where: { id } }));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async listStalePending(before: Date, limit: number): Promise<MediaAsset[]> {
    const rows = await this.repository.find({
      where: { status: MediaStatus.PENDING, createdAt: LessThan(before) },
      take: limit,
    });
    return rows.map(toAsset);
  }
}
