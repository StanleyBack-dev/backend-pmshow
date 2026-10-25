import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { AppException } from "@/common/exceptions/app-exception";
import {
  parseIsoDuration,
  YoutubeDataApiAdapter,
} from "@/modules/media/infrastructure/youtube/youtube-data-api.adapter";

const adapter = () =>
  new YoutubeDataApiAdapter({ get: () => "k" } as unknown as ConfigService);

const respond = (body: unknown, status = 200) =>
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("YoutubeDataApiAdapter", () => {
  beforeAll(() => Logger.overrideLogger(false));
  afterEach(() => jest.restoreAllMocks());

  it("asks only for embeddable videos and maps the results", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: { videoId: "abc123" },
              snippet: {
                title: "Hino &amp; Marcha",
                channelTitle: "Banda PM",
                publishedAt: "2024-01-01T00:00:00Z",
                thumbnails: {
                  medium: { url: "https://i.ytimg.com/vi/abc/m.jpg" },
                },
              },
            },
            { id: {}, snippet: { title: "channel, not a video" } },
          ],
        }),
      ),
    );
    // Second call: the durations of the videos found.
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ id: "abc123", contentDetails: { duration: "PT3M45S" } }],
        }),
      ),
    );

    const results = await adapter().search("hino", 10);

    const url = fetchSpy.mock.calls[0][0] as URL;
    expect(url.searchParams.get("videoEmbeddable")).toBe("true");
    expect(url.searchParams.get("maxResults")).toBe("10");
    expect(String(fetchSpy.mock.calls[1][0])).toContain("id=abc123");
    expect(results).toEqual([
      {
        videoId: "abc123",
        title: "Hino & Marcha",
        channelTitle: "Banda PM",
        thumbnailUrl: "https://i.ytimg.com/vi/abc/m.jpg",
        publishedAt: "2024-01-01T00:00:00Z",
        durationSeconds: 225,
      },
    ]);
  });

  it("keeps the results when the durations call fails", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: { videoId: "abc123" }, snippet: { title: "Hino" } }],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const [result] = await adapter().search("hino", 10);
    expect(result.videoId).toBe("abc123");
    expect(result.durationSeconds).toBeNull();
  });

  it("fails with MEDIA_YOUTUBE_SEARCH_FAILED when the API refuses", async () => {
    respond({ error: "quota" }, 403);
    const error = await adapter()
      .search("hino", 10)
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(502);
    expect((error as AppException).getResponse()).toMatchObject({
      code: "MEDIA_YOUTUBE_SEARCH_FAILED",
    });
  });
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT3M45S", 225],
    ["PT1H2M", 3720],
    ["PT59S", 59],
    ["P1DT1S", 86_401],
  ])("%s → %d seconds", (value, seconds) => {
    expect(parseIsoDuration(value)).toBe(seconds);
  });

  it.each(["", "PT", "P0D", "3:45"])("%p → null", (value) => {
    expect(parseIsoDuration(value)).toBeNull();
  });
});
