import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  LyricsProviderPort,
  LyricsResult,
} from "@/modules/repertoire/application/ports/lyrics.port";

const SEARCH_URL = "https://api.vagalume.com.br/search.php";
const TIMEOUT_MS = 8_000;

type VagalumeResponse = {
  type?: string;
  art?: { name?: string };
  mus?: { name?: string; text?: string; url?: string }[];
};

// Vagalume (Brazilian lyrics catalog): optional last resort, used only
// when VAGALUME_API_KEY is set. The response is read defensively: anything
// unexpected counts as "not found", never an error.
@Injectable()
export class VagalumeLyricsAdapter implements LyricsProviderPort {
  private readonly logger = new Logger(VagalumeLyricsAdapter.name);
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("VAGALUME_API_KEY") || "";
  }

  async find(artist: string, title: string): Promise<LyricsResult | null> {
    if (!this.apiKey) return null;
    const url = new URL(SEARCH_URL);
    url.searchParams.set("art", artist);
    url.searchParams.set("mus", title);
    url.searchParams.set("apikey", this.apiKey);

    let data: VagalumeResponse;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`Vagalume respondeu HTTP ${response.status}`);
        return null;
      }
      data = (await response.json()) as VagalumeResponse;
    } catch (error) {
      this.logger.warn(`Vagalume indisponível: ${String(error)}`);
      return null;
    }

    const song = data.mus?.[0];
    if (
      (data.type !== "exact" && data.type !== "aprox") ||
      !song?.text?.trim()
    ) {
      return null;
    }
    return {
      artist: data.art?.name?.trim() || artist,
      title: song.name?.trim() || title,
      lyrics: song.text.trim(),
      sourceUrl: song.url ?? null,
    };
  }
}
