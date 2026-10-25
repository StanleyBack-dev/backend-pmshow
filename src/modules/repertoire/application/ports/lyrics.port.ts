export type LyricsResult = {
  /** Artist and title as the provider knows them (canonical spelling). */
  artist: string;
  title: string;
  lyrics: string;
  /** Page of the lyrics at the provider (credit / attribution). */
  sourceUrl: string | null;
};

export interface LyricsProviderPort {
  /** Null when the provider doesn't know the song (or is unavailable). */
  find(artist: string, title: string): Promise<LyricsResult | null>;
}

export const LYRICS_PROVIDER = Symbol("LYRICS_PROVIDER");
