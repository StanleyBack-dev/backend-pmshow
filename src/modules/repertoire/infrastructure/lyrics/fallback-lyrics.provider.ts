import type {
  LyricsProviderPort,
  LyricsResult,
} from "@/modules/repertoire/application/ports/lyrics.port";

// Asks each provider in order and keeps the first lyrics found, so one
// catalog being down (or not knowing the song) doesn't block the lookup.
export class FallbackLyricsProvider implements LyricsProviderPort {
  constructor(private readonly providers: LyricsProviderPort[]) {}

  async find(artist: string, title: string): Promise<LyricsResult | null> {
    for (const provider of this.providers) {
      const found = await provider.find(artist, title);
      if (found) return found;
    }
    return null;
  }
}
