import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  MEDIA_ASSET_REPOSITORY,
  OBJECT_STORAGE,
  YOUTUBE_METADATA,
  YOUTUBE_SEARCH,
  type MediaAssetRepositoryPort,
  type ObjectStoragePort,
  type UploadForm,
  type YoutubeMetadataPort,
  type YoutubeSearchPort,
  type YoutubeSearchResult,
} from "@/modules/media/application/ports/media.ports";
import {
  audioExtension,
  audioStorageKey,
  downloadFileName,
  MediaKind,
  MediaStatus,
  parseYoutubeVideoId,
  type MediaAsset,
} from "@/modules/media/domain/media";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const UPLOAD_FORM_TTL_SECONDS = 10 * 60;
/** PENDING uploads older than this are abandoned and get purged. */
const STALE_PENDING_MS = 60 * 60 * 1000;

export type AudioUploadTicket = { asset: MediaAsset; upload: UploadForm };

const YOUTUBE_SEARCH_LIMIT = 10;

@Injectable()
export class MediaUseCase {
  private readonly logger = new Logger(MediaUseCase.name);
  private readonly maxAudioBytes: number;
  private readonly maxAudioMb: number;

  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY)
    private readonly assets: MediaAssetRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(YOUTUBE_METADATA) private readonly youtube: YoutubeMetadataPort,
    @Inject(YOUTUBE_SEARCH) private readonly youtubeSearch: YoutubeSearchPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly songs: SongsUseCase,
    private readonly audit: AuditTrailService,
    config: ConfigService,
  ) {
    this.maxAudioMb = config.get<number>("MEDIA_MAX_AUDIO_MB") ?? 50;
    this.maxAudioBytes = this.maxAudioMb * 1024 * 1024;
  }

  listReady(songId: string): Promise<MediaAsset[]> {
    return this.assets.listBySong(songId, MediaStatus.READY);
  }

  /** Ready media of many songs, grouped by song (list pages). */
  async listReadyBySong(
    songIds: readonly string[],
  ): Promise<Map<string, MediaAsset[]>> {
    const assets = await this.assets.listBySongs(songIds, MediaStatus.READY);
    const bySong = new Map<string, MediaAsset[]>(songIds.map((id) => [id, []]));
    for (const asset of assets) bySong.get(asset.songId)?.push(asset);
    return bySong;
  }

  /** YouTube videos for the song form (embeddable only). */
  searchYoutube(query: string): Promise<YoutubeSearchResult[]> {
    if (!this.youtubeSearch.configured()) {
      throw AppException.from(
        APP_ERRORS.media.youtubeSearchNotConfigured,
        undefined,
      );
    }
    const term = query.trim().replace(/\s+/g, " ").slice(0, 120);
    if (term.length < 2) return Promise.resolve([]);
    return this.youtubeSearch.search(term, YOUTUBE_SEARCH_LIMIT);
  }

  // --- YouTube -----------------------------------------------------------

  async addYoutubeVideo(
    actor: AuthenticatedUser,
    songId: string,
    link: string,
    title?: string | null,
  ): Promise<MediaAsset> {
    await this.songs.getActive(songId);
    const videoId = parseYoutubeVideoId(link);
    if (!videoId) {
      throw AppException.from(APP_ERRORS.media.invalidYoutubeLink, undefined);
    }
    if (await this.assets.findVideo(songId, videoId)) {
      throw AppException.from(APP_ERRORS.media.duplicateVideo, undefined);
    }
    const info = await this.youtube.fetch(videoId);
    if (!info) {
      throw AppException.from(APP_ERRORS.media.youtubeUnavailable, undefined);
    }
    // Duration needs the Data API key; without it the video is still added.
    const durationSeconds = this.youtubeSearch.configured()
      ? ((await this.youtubeSearch.durations([videoId])).get(videoId) ?? null)
      : null;

    const asset = await this.assets.create({
      songId,
      kind: MediaKind.VIDEO,
      status: MediaStatus.READY,
      title: title?.trim() || info.title.slice(0, 160),
      storageKey: null,
      mimeType: null,
      sizeBytes: null,
      durationSeconds,
      youtubeVideoId: videoId,
      thumbnailUrl: info.thumbnailUrl,
      createdBy: actor.id,
    });
    await this.songs.fillDurationIfMissing(songId, durationSeconds);
    await this.record(actor, "media.video_added", asset);
    return asset;
  }

  // --- audio upload (browser → storage, directly) -------------------------

  /** Step 1: a signed form the browser uses to upload straight to storage. */
  async requestAudioUpload(
    actor: AuthenticatedUser,
    songId: string,
    file: { mimeType: string; sizeBytes: number; title: string },
  ): Promise<AudioUploadTicket> {
    await this.songs.getActive(songId);
    const mimeType = file.mimeType.toLowerCase();
    const extension = audioExtension(mimeType);
    if (!extension) {
      throw AppException.from(APP_ERRORS.media.unsupportedAudio, undefined);
    }
    this.assertSize(file.sizeBytes);

    const id = randomUUID();
    const storageKey = audioStorageKey(songId, id, extension);
    // The form is created first: if storage is unavailable no row is left.
    const upload = await this.storage.createUploadForm({
      key: storageKey,
      contentType: mimeType,
      maxBytes: this.maxAudioBytes,
      expiresInSeconds: UPLOAD_FORM_TTL_SECONDS,
    });
    const asset = await this.assets.create({
      id,
      songId,
      kind: MediaKind.AUDIO,
      status: MediaStatus.PENDING,
      title: file.title.trim().slice(0, 160),
      storageKey,
      mimeType,
      sizeBytes: file.sizeBytes,
      durationSeconds: null,
      youtubeVideoId: null,
      thumbnailUrl: null,
      createdBy: actor.id,
    });
    return { asset, upload };
  }

  /** Step 2: checks the file really landed in storage, then publishes it. */
  async confirmAudioUpload(
    actor: AuthenticatedUser,
    assetId: string,
    durationSeconds: number | null,
  ): Promise<MediaAsset> {
    const asset = await this.get(assetId);
    if (asset.kind !== MediaKind.AUDIO) {
      throw AppException.from(APP_ERRORS.media.notAudio, undefined);
    }
    if (asset.status === MediaStatus.READY) {
      throw AppException.from(
        APP_ERRORS.media.uploadAlreadyConfirmed,
        undefined,
      );
    }

    const stored = await this.storage.head(asset.storageKey as string);
    if (!stored || stored.sizeBytes === 0) {
      throw AppException.from(APP_ERRORS.media.uploadNotReceived, undefined);
    }
    // The signed form already caps the size; this guards a misconfigured
    // storage.
    if (stored.sizeBytes > this.maxAudioBytes) {
      await this.discard(asset);
      this.assertSize(stored.sizeBytes);
    }

    const ready = await this.assets.update(assetId, {
      status: MediaStatus.READY,
      sizeBytes: stored.sizeBytes,
      durationSeconds:
        durationSeconds && durationSeconds > 0
          ? Math.round(durationSeconds)
          : null,
    });
    await this.songs.fillDurationIfMissing(ready.songId, ready.durationSeconds);
    await this.record(actor, "media.audio_uploaded", ready);
    return ready;
  }

  // --- playback / download -------------------------------------------------

  async playbackUrl(assetId: string): Promise<string> {
    const asset = await this.readyAudio(assetId);
    return this.storage.signedReadUrl(asset.storageKey as string);
  }

  async downloadUrl(assetId: string): Promise<string> {
    const asset = await this.readyAudio(assetId);
    const extension = audioExtension(asset.mimeType ?? "") ?? "mp3";
    return this.storage.signedReadUrl(asset.storageKey as string, {
      downloadName: downloadFileName(asset.title, extension),
    });
  }

  // --- management ----------------------------------------------------------

  async rename(
    actor: AuthenticatedUser,
    assetId: string,
    title: string,
  ): Promise<MediaAsset> {
    await this.get(assetId);
    const updated = await this.assets.update(assetId, {
      title: title.trim().slice(0, 160),
    });
    await this.record(actor, "media.renamed", updated);
    return updated;
  }

  async remove(actor: AuthenticatedUser, assetId: string): Promise<void> {
    const asset = await this.get(assetId);
    await this.discard(asset);
    await this.record(actor, "media.removed", asset);
  }

  /** Purges uploads that were requested but never confirmed. */
  async purgeStaleUploads(): Promise<{ purged: number }> {
    const stale = await this.assets.listStalePending(
      new Date(this.clock.now().getTime() - STALE_PENDING_MS),
      200,
    );
    for (const asset of stale) await this.discard(asset);
    return { purged: stale.length };
  }

  private async get(assetId: string): Promise<MediaAsset> {
    const asset = await this.assets.findById(assetId);
    if (!asset) throw AppException.from(APP_ERRORS.media.notFound, undefined);
    return asset;
  }

  private async readyAudio(assetId: string): Promise<MediaAsset> {
    const asset = await this.get(assetId);
    if (asset.kind !== MediaKind.AUDIO || asset.status !== MediaStatus.READY) {
      throw AppException.from(APP_ERRORS.media.notAudio, undefined);
    }
    return asset;
  }

  // Row first: once it is gone nobody can reach the file, even if deleting
  // the object fails (it would only waste space).
  private async discard(asset: MediaAsset): Promise<void> {
    await this.assets.delete(asset.id);
    if (!asset.storageKey) return;
    try {
      await this.storage.deleteMany([asset.storageKey]);
    } catch (error) {
      this.logger.warn(
        `Object ${asset.storageKey} not deleted from storage: ${String(error)}`,
      );
    }
  }

  private assertSize(sizeBytes: number): void {
    if (sizeBytes > this.maxAudioBytes) {
      throw AppException.from(APP_ERRORS.media.audioTooLarge, {
        maxMb: this.maxAudioMb,
      });
    }
  }

  private record(
    actor: AuthenticatedUser,
    action: string,
    asset: MediaAsset,
  ): Promise<void> {
    return this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action,
      entity: "media",
      entityId: asset.id,
      after: {
        songId: asset.songId,
        kind: asset.kind,
        title: asset.title,
        youtubeVideoId: asset.youtubeVideoId,
      },
    });
  }
}
