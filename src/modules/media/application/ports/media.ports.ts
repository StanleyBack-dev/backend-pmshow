import type { MediaAsset, MediaStatus } from "@/modules/media/domain/media";

// --- persistence --------------------------------------------------------

export type NewMediaAsset = Omit<MediaAsset, "id" | "createdAt"> & {
  id?: string;
};

export interface MediaAssetRepositoryPort {
  listBySong(songId: string, status: MediaStatus): Promise<MediaAsset[]>;
  findById(id: string): Promise<MediaAsset | null>;
  findVideo(songId: string, youtubeVideoId: string): Promise<MediaAsset | null>;
  create(asset: NewMediaAsset): Promise<MediaAsset>;
  update(
    id: string,
    patch: Partial<
      Pick<MediaAsset, "status" | "title" | "sizeBytes" | "durationSeconds">
    >,
  ): Promise<MediaAsset>;
  delete(id: string): Promise<void>;
  /** PENDING uploads older than `before` (abandoned). */
  listStalePending(before: Date, limit: number): Promise<MediaAsset[]>;
}

export const MEDIA_ASSET_REPOSITORY = Symbol("MEDIA_ASSET_REPOSITORY");

// --- object storage (Neon Object Storage, S3-compatible) -----------------

export type UploadForm = {
  /** The browser POSTs a multipart form with `fields` + the file here. */
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
};

export interface ObjectStoragePort {
  /** Presigned POST: the storage itself enforces key, type and size. */
  createUploadForm(params: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds: number;
  }): Promise<UploadForm>;
  head(
    key: string,
  ): Promise<{ sizeBytes: number; contentType: string | null } | null>;
  /** Short-lived signed GET; `downloadName` makes the browser save the file. */
  signedReadUrl(
    key: string,
    options?: { downloadName?: string },
  ): Promise<string>;
  deleteMany(keys: string[]): Promise<void>;
}

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

// --- YouTube metadata ----------------------------------------------------

export type YoutubeVideoInfo = {
  title: string;
  authorName: string | null;
  thumbnailUrl: string | null;
};

export interface YoutubeMetadataPort {
  /** null when the video does not exist, is private or can't be embedded. */
  fetch(videoId: string): Promise<YoutubeVideoInfo | null>;
}

export const YOUTUBE_METADATA = Symbol("YOUTUBE_METADATA");
