import { Injectable, Logger } from "@nestjs/common";
import type {
  LyricsProviderPort,
  LyricsResult,
} from "@/modules/repertoire/application/ports/lyrics.port";

const BASE_URL = "https://api.lyrics.ovh/v1";
const TIMEOUT_MS = 8_000;
// Some answers start with a French header line ("Paroles de la chanson …").
const HEADER = /^paroles de la chanson[^\n]*\n/i;

// lyrics.ovh: free, no API key, exact artist + title only. It doesn't
// return the canonical names, so the ones asked for are kept.
@Injectable()
export class LyricsOvhAdapter implements LyricsProviderPort {
  private readonly logger = new Logger(LyricsOvhAdapter.name);

  async find(artist: string, title: string): Promise<LyricsResult | null> {
    const url = `${BASE_URL}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // 404 = song not found.
      if (!response.ok) {
        if (response.status !== 404) {
          this.logger.warn(`lyrics.ovh respondeu HTTP ${response.status}`);
        }
        return null;
      }
      const data = (await response.json()) as { lyrics?: unknown };
      if (typeof data.lyrics !== "string") return null;
      const lyrics = data.lyrics.replace(/\r\n/g, "\n").replace(HEADER, "");
      return lyrics.trim()
        ? { artist, title, lyrics: lyrics.trim(), sourceUrl: null }
        : null;
    } catch (error) {
      this.logger.warn(`lyrics.ovh indisponível: ${String(error)}`);
      return null;
    }
  }
}
