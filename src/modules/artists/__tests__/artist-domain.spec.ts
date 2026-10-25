import {
  artistKey,
  normalizeArtistName,
} from "@/modules/artists/domain/artist";
import { decodeEntities } from "@/modules/media/infrastructure/youtube/youtube-data-api.adapter";

describe("normalizeArtistName", () => {
  it("trims, collapses spaces and stores in lowercase", () => {
    expect(normalizeArtistName("  Zé   RAMALHO ")).toBe("zé ramalho");
  });

  it("refuses names too short or too long", () => {
    expect(normalizeArtistName(" A ")).toBeNull();
    expect(normalizeArtistName("x".repeat(121))).toBeNull();
  });
});

describe("artistKey", () => {
  it("ignores accents, case and extra spaces", () => {
    expect(artistKey("Zé  Ramalho")).toBe(artistKey("ze ramalho"));
    expect(artistKey("CHITÃOZINHO & XORORÓ")).toBe("chitaozinho & xororo");
  });
});

describe("decodeEntities (YouTube titles)", () => {
  it("decodes the entities the API escapes", () => {
    expect(
      decodeEntities("Hino &amp; Marcha &quot;ao vivo&quot; d&#39;água"),
    ).toBe('Hino & Marcha "ao vivo" d\'água');
  });
});
