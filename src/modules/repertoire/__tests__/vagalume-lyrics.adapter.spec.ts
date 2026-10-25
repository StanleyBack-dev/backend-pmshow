import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { VagalumeLyricsAdapter } from "@/modules/repertoire/infrastructure/lyrics/vagalume-lyrics.adapter";

const config = (key: string) =>
  ({ get: () => key }) as unknown as ConfigService;

const respond = (body: unknown, status = 200) =>
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("VagalumeLyricsAdapter", () => {
  beforeAll(() => Logger.overrideLogger(false));
  afterEach(() => jest.restoreAllMocks());

  it("is skipped (no request) without an API key", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    await expect(
      new VagalumeLyricsAdapter(config("")).find("a", "b"),
    ).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the catalog spelling of artist and title", async () => {
    respond({
      type: "exact",
      art: { name: "Henrique & Juliano" },
      mus: [{ name: "Recaídas", text: " letra \n", url: "https://x/y" }],
    });
    const found = await new VagalumeLyricsAdapter(config("k")).find(
      "henrique e juliano",
      "recaidas",
    );
    expect(found).toEqual({
      artist: "Henrique & Juliano",
      title: "Recaídas",
      lyrics: "letra",
      sourceUrl: "https://x/y",
    });
  });

  it.each([
    ["song not found", { type: "song_notfound" }],
    ["artist not found", { type: "notfound" }],
    ["empty lyrics", { type: "exact", mus: [{ name: "X", text: "  " }] }],
  ])("returns null on %s", async (_case, body) => {
    respond(body);
    await expect(
      new VagalumeLyricsAdapter(config("k")).find("a", "b"),
    ).resolves.toBeNull();
  });

  it("returns null when the service fails", async () => {
    respond({}, 500);
    await expect(
      new VagalumeLyricsAdapter(config("k")).find("a", "b"),
    ).resolves.toBeNull();
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    await expect(
      new VagalumeLyricsAdapter(config("k")).find("a", "b"),
    ).resolves.toBeNull();
  });
});
