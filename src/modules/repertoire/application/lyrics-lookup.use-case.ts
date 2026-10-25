import { Inject, Injectable } from "@nestjs/common";
import {
  LYRICS_PROVIDER,
  type LyricsProviderPort,
  type LyricsResult,
} from "@/modules/repertoire/application/ports/lyrics.port";

// Finds the full lyrics of a song to fill the song form. Nothing is stored
// here: the manager reviews the text and saves it with the song.
@Injectable()
export class LyricsLookupUseCase {
  constructor(
    @Inject(LYRICS_PROVIDER) private readonly provider: LyricsProviderPort,
  ) {}

  async find(artist: string, title: string): Promise<LyricsResult | null> {
    const cleanArtist = artist.trim();
    const cleanTitle = title.trim();
    if (!cleanArtist || !cleanTitle) return null;
    return this.provider.find(cleanArtist, cleanTitle);
  }
}
