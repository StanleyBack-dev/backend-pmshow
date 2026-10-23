import { Injectable, Logger } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type {
  YoutubeMetadataPort,
  YoutubeVideoInfo,
} from "@/modules/media/application/ports/media.ports";

const OEMBED_URL = "https://www.youtube.com/oembed";
const TIMEOUT_MS = 8_000;

type OEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

// oEmbed needs no API key and answers 401/403/404 for videos that are
// private, removed or not embeddable — exactly the ones the app can't show.
@Injectable()
export class YoutubeOEmbedAdapter implements YoutubeMetadataPort {
  private readonly logger = new Logger(YoutubeOEmbedAdapter.name);

  async fetch(videoId: string): Promise<YoutubeVideoInfo | null> {
    const url = new URL(OEMBED_URL);
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
    url.searchParams.set("format", "json");

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
    } catch (error) {
      this.logger.warn(`YouTube oEmbed unreachable: ${String(error)}`);
      throw AppException.from(APP_ERRORS.media.youtubeLookupFailed, undefined);
    }

    if ([400, 401, 403, 404].includes(response.status)) return null;
    if (!response.ok) {
      this.logger.warn(`YouTube oEmbed answered HTTP ${response.status}`);
      throw AppException.from(APP_ERRORS.media.youtubeLookupFailed, undefined);
    }

    const body = (await response.json().catch(() => ({}))) as OEmbedResponse;
    return {
      title: body.title?.trim() || "Vídeo do YouTube",
      authorName: body.author_name ?? null,
      // hqdefault always exists; oEmbed's thumbnail is the same image.
      thumbnailUrl:
        body.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
}
