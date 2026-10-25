import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type {
  YoutubeSearchPort,
  YoutubeSearchResult,
} from "@/modules/media/application/ports/media.ports";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const TIMEOUT_MS = 8_000;

type SearchResponse = {
  items?: {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    };
  }[];
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

/** ISO 8601 duration of the API ("PT3M45S", "PT1H2M") in seconds. */
export function parseIsoDuration(value: string): number | null {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match || value === "P" || value === "PT") return null;
  const [, days, hours, minutes, seconds] = match.map(Number);
  const total =
    (days || 0) * 86_400 +
    (hours || 0) * 3_600 +
    (minutes || 0) * 60 +
    (seconds || 0);
  return total > 0 ? total : null;
}

/** The API returns titles HTML-escaped ("Hino &amp; Marcha"). */
export function decodeEntities(value: string): string {
  return value.replace(/&(amp|quot|#39|lt|gt);/g, (match) => ENTITIES[match]);
}

// YouTube Data API v3, search.list: free, but each search spends 100 of the
// project's 10,000 daily quota units. Only embeddable videos are listed,
// since the app plays them embedded.
@Injectable()
export class YoutubeDataApiAdapter implements YoutubeSearchPort {
  private readonly logger = new Logger(YoutubeDataApiAdapter.name);
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("YOUTUBE_API_KEY") || "";
  }

  configured(): boolean {
    return this.apiKey.length > 0;
  }

  async search(query: string, limit: number): Promise<YoutubeSearchResult[]> {
    const url = new URL(SEARCH_URL);
    url.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      videoEmbeddable: "true",
      maxResults: String(limit),
      regionCode: "BR",
      relevanceLanguage: "pt",
      q: query,
      key: this.apiKey,
    }).toString();

    let data: SearchResponse;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        // 403 is usually the daily quota.
        this.logger.warn(`YouTube search respondeu HTTP ${response.status}`);
        throw AppException.from(
          APP_ERRORS.media.youtubeSearchFailed,
          undefined,
        );
      }
      data = (await response.json()) as SearchResponse;
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.warn(`YouTube search indisponível: ${String(error)}`);
      throw AppException.from(APP_ERRORS.media.youtubeSearchFailed, undefined);
    }

    const results = (data.items ?? []).flatMap((item) => {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet?.title) return [];
      return [
        {
          videoId,
          title: decodeEntities(snippet.title),
          channelTitle: decodeEntities(snippet.channelTitle ?? ""),
          thumbnailUrl:
            snippet.thumbnails?.medium?.url ??
            snippet.thumbnails?.default?.url ??
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          publishedAt: snippet.publishedAt ?? null,
          durationSeconds: null as number | null,
        },
      ];
    });
    // One extra call (1 quota unit) for all durations; the search still
    // works without them.
    const durations = await this.durations(results.map((r) => r.videoId));
    return results.map((result) => ({
      ...result,
      durationSeconds: durations.get(result.videoId) ?? null,
    }));
  }

  async durations(videoIds: readonly string[]): Promise<Map<string, number>> {
    const found = new Map<string, number>();
    if (videoIds.length === 0) return found;
    const url = new URL(VIDEOS_URL);
    url.search = new URLSearchParams({
      part: "contentDetails",
      id: videoIds.slice(0, 50).join(","),
      key: this.apiKey,
    }).toString();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`YouTube videos respondeu HTTP ${response.status}`);
        return found;
      }
      const data = (await response.json()) as {
        items?: { id?: string; contentDetails?: { duration?: string } }[];
      };
      for (const item of data.items ?? []) {
        const seconds = item.contentDetails?.duration
          ? parseIsoDuration(item.contentDetails.duration)
          : null;
        if (item.id && seconds) found.set(item.id, seconds);
      }
    } catch (error) {
      this.logger.warn(`YouTube videos indisponível: ${String(error)}`);
    }
    return found;
  }
}
