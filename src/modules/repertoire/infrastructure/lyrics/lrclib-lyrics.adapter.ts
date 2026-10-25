import { Injectable, Logger } from "@nestjs/common";
import type {
  LyricsProviderPort,
  LyricsResult,
} from "@/modules/repertoire/application/ports/lyrics.port";

const SEARCH_URL = "https://lrclib.net/api/search";
const TIMEOUT_MS = 8_000;
// LRCLIB asks clients to identify themselves.
const USER_AGENT = "PM SHOW (repertoire lyrics lookup)";

type LrclibTrack = {
  trackName?: string;
  artistName?: string;
  instrumental?: boolean;
  plainLyrics?: string | null;
};

// LRCLIB: open lyrics database, free and without an API key. Failures and
// odd responses count as "not found", so the next provider is tried.
@Injectable()
export class LrclibLyricsAdapter implements LyricsProviderPort {
  private readonly logger = new Logger(LrclibLyricsAdapter.name);

  async find(artist: string, title: string): Promise<LyricsResult | null> {
    const byFields = await this.search({
      artist_name: artist,
      track_name: title,
    });
    const track = byFields ?? (await this.search({ q: `${artist} ${title}` }));
    if (!track?.plainLyrics) return null;
    return {
      artist: track.artistName?.trim() || artist,
      title: track.trackName?.trim() || title,
      lyrics: track.plainLyrics.trim(),
      sourceUrl: null,
    };
  }

  private async search(
    params: Record<string, string>,
  ): Promise<LrclibTrack | null> {
    try {
      const response = await fetch(
        `${SEARCH_URL}?${new URLSearchParams(params)}`,
        {
          headers: { "user-agent": USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        this.logger.warn(`LRCLIB respondeu HTTP ${response.status}`);
        return null;
      }
      const tracks = (await response.json()) as unknown;
      if (!Array.isArray(tracks)) return null;
      return (
        (tracks as LrclibTrack[]).find(
          (track) => !track.instrumental && track.plainLyrics?.trim(),
        ) ?? null
      );
    } catch (error) {
      this.logger.warn(`LRCLIB indisponível: ${String(error)}`);
      return null;
    }
  }
}
