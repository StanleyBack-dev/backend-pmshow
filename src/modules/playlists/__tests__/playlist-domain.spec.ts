import {
  PLAYLIST_LIMITS,
  normalizePlaylist,
  playlistSongIds,
  type PlaylistItem,
} from "@/modules/playlists/domain/playlist";

const SONG_A = "0b6f6c3e-6d0f-4c3b-9f36-1f0e3c1a2b01";
const SONG_B = "0b6f6c3e-6d0f-4c3b-9f36-1f0e3c1a2b02";

const video = (videoId: string, title = "Aquarela - Toquinho") => ({
  kind: "video" as const,
  video: { videoId, title, channelTitle: "Toquinho" },
});

const draft = (items: PlaylistItem[]) => ({
  name: "Ensaio de quinta",
  shared: false,
  items,
});

describe("normalizePlaylist", () => {
  it("keeps songs and videos in order, each once", () => {
    const result = normalizePlaylist(
      draft([
        { kind: "song", songId: SONG_A },
        video("dQw4w9WgXcQ"),
        { kind: "song", songId: SONG_A },
        { kind: "song", songId: SONG_B },
        video("dQw4w9WgXcQ"),
      ]),
    );
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        items: [
          { kind: "song", songId: SONG_A },
          video("dQw4w9WgXcQ"),
          { kind: "song", songId: SONG_B },
        ],
      }),
    });
  });

  it("trims the video title and drops an empty channel", () => {
    const result = normalizePlaylist(
      draft([
        {
          kind: "video",
          video: {
            videoId: "dQw4w9WgXcQ",
            title: "  Aquarela   ao vivo ",
            channelTitle: "  ",
          },
        },
      ]),
    );
    expect(result.ok && result.value.items[0]).toEqual({
      kind: "video",
      video: {
        videoId: "dQw4w9WgXcQ",
        title: "Aquarela ao vivo",
        channelTitle: null,
      },
    });
  });

  it("refuses a video with a bad id or without a title", () => {
    expect(normalizePlaylist(draft([video("not-an-id")]))).toEqual({
      ok: false,
      violation: "invalid-video",
    });
    expect(normalizePlaylist(draft([video("dQw4w9WgXcQ", "   ")]))).toEqual({
      ok: false,
      violation: "invalid-video",
    });
  });

  it("limits the number of items", () => {
    const items = Array.from({ length: PLAYLIST_LIMITS.items + 1 }, (_, i) =>
      video(`video${String(i).padStart(6, "0")}`),
    );
    expect(normalizePlaylist(draft(items))).toEqual({
      ok: false,
      violation: "too-many-items",
    });
  });
});

describe("playlistSongIds", () => {
  it("lists only the songs of the repertoire", () => {
    expect(
      playlistSongIds([
        { kind: "song", songId: SONG_A },
        video("dQw4w9WgXcQ"),
        { kind: "song", songId: SONG_B },
      ]),
    ).toEqual([SONG_A, SONG_B]);
  });
});
