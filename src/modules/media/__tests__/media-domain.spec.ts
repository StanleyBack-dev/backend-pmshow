import {
  audioExtension,
  audioStorageKey,
  downloadFileName,
  parseYoutubeVideoId,
} from "@/modules/media/domain/media";

describe("parseYoutubeVideoId", () => {
  const id = "dQw4w9WgXcQ";

  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `  https://youtu.be/${id}  `,
  ])("reads the id from %s", (link) => {
    expect(parseYoutubeVideoId(link)).toBe(id);
  });

  it.each([
    "not a link",
    `https://vimeo.com/${id}`,
    `https://youtube.com.evil.example/watch?v=${id}`,
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@canal",
    `javascript:alert('${id}')`,
    `ftp://youtu.be/${id}`,
  ])("rejects %s", (link) => {
    expect(parseYoutubeVideoId(link)).toBeNull();
  });
});

describe("audio files", () => {
  it("maps accepted types to an extension", () => {
    expect(audioExtension("audio/mpeg")).toBe("mp3");
    expect(audioExtension("AUDIO/MP4")).toBe("m4a");
    expect(audioExtension("video/mp4")).toBeNull();
    expect(audioExtension("application/pdf")).toBeNull();
  });

  it("scopes the key by song", () => {
    expect(audioStorageKey("song-1", "asset-1", "mp3")).toBe(
      "songs/song-1/audio/asset-1.mp3",
    );
  });

  it("builds a safe download name", () => {
    expect(downloadFileName("Hino Nacional (ao vivo)", "mp3")).toBe(
      "hino-nacional-ao-vivo.mp3",
    );
    expect(downloadFileName("Canção do Expedicionário", "m4a")).toBe(
      "cancao-do-expedicionario.m4a",
    );
    expect(downloadFileName('"; rm -rf /', "mp3")).toBe("rm-rf.mp3");
    expect(downloadFileName("!!!", "mp3")).toBe("audio.mp3");
  });
});
