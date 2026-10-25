import { Logger } from "@nestjs/common";
import type { LyricsProviderPort } from "@/modules/repertoire/application/ports/lyrics.port";
import { FallbackLyricsProvider } from "@/modules/repertoire/infrastructure/lyrics/fallback-lyrics.provider";
import { LrclibLyricsAdapter } from "@/modules/repertoire/infrastructure/lyrics/lrclib-lyrics.adapter";
import { LyricsOvhAdapter } from "@/modules/repertoire/infrastructure/lyrics/lyrics-ovh.adapter";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("keyless lyrics providers", () => {
  beforeAll(() => Logger.overrideLogger(false));
  afterEach(() => jest.restoreAllMocks());

  describe("LrclibLyricsAdapter", () => {
    it("skips instrumentals and returns the catalog names", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(
        reply([
          { trackName: "Hino", instrumental: true, plainLyrics: null },
          {
            trackName: "Hino Nacional Brasileiro",
            artistName: "Péricles",
            plainLyrics: "Ouviram do Ipiranga\n",
          },
        ]),
      );
      await expect(
        new LrclibLyricsAdapter().find("pericles", "hino nacional"),
      ).resolves.toEqual({
        artist: "Péricles",
        title: "Hino Nacional Brasileiro",
        lyrics: "Ouviram do Ipiranga",
        sourceUrl: null,
      });
    });

    it("retries as free text, then gives up on errors", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(reply([]))
        .mockResolvedValueOnce(reply({ message: "busy" }, 503));
      await expect(
        new LrclibLyricsAdapter().find("a", "b"),
      ).resolves.toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(String(fetchSpy.mock.calls[1][0])).toContain("q=a+b");
    });
  });

  describe("LyricsOvhAdapter", () => {
    it("drops the French header line", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(
        reply({
          lyrics: "Paroles de la chanson Recaídas par X\r\nVocê pode ficar\r\n",
        }),
      );
      const found = await new LyricsOvhAdapter().find("X", "Recaídas");
      expect(found?.lyrics).toBe("Você pode ficar");
      expect(found?.artist).toBe("X");
    });

    it("returns null when the song is unknown", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(reply({ error: "No lyrics found" }, 404));
      await expect(new LyricsOvhAdapter().find("a", "b")).resolves.toBeNull();
    });
  });

  describe("FallbackLyricsProvider", () => {
    it("returns the first provider that knows the song", async () => {
      const missing: LyricsProviderPort = { find: jest.fn(async () => null) };
      const found = { artist: "A", title: "B", lyrics: "L", sourceUrl: null };
      const hit: LyricsProviderPort = { find: jest.fn(async () => found) };
      const never: LyricsProviderPort = { find: jest.fn() };

      const chain = new FallbackLyricsProvider([missing, hit, never]);

      await expect(chain.find("A", "B")).resolves.toBe(found);
      expect(never.find).not.toHaveBeenCalled();
    });
  });
});
