export enum MediaKind {
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
}

export enum MediaStatus {
  /** Upload requested, file not confirmed in storage yet. */
  PENDING = "PENDING",
  READY = "READY",
}

export type MediaAsset = {
  id: string;
  songId: string;
  kind: MediaKind;
  status: MediaStatus;
  title: string;
  /** AUDIO only. */
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  /** VIDEO only. */
  youtubeVideoId: string | null;
  thumbnailUrl: string | null;
  createdBy: string | null;
  createdAt: Date;
};

// --- audio --------------------------------------------------------------

/** Accepted audio formats and the extension stored with them. */
export const AUDIO_TYPES: Readonly<Record<string, string>> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
};

export function audioExtension(mimeType: string): string | null {
  return AUDIO_TYPES[mimeType.toLowerCase()] ?? null;
}

/** Object key, scoped by song so a song's files are easy to find or purge. */
export function audioStorageKey(
  songId: string,
  assetId: string,
  extension: string,
): string {
  return `songs/${songId}/audio/${assetId}.${extension}`;
}

/** File name offered on download, e.g. "hino-nacional.mp3". */
export function downloadFileName(title: string, extension: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "audio"}.${extension}`;
}

// --- YouTube ------------------------------------------------------------

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Whether `value` has the shape of a YouTube video id. */
export const isYoutubeVideoId = (value: string): boolean =>
  VIDEO_ID.test(value);
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
]);

/**
 * The 11-character video id from any usual YouTube link (watch, youtu.be,
 * shorts, embed, live), or null when the link is not a YouTube video.
 */
export function parseYoutubeVideoId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const [first, second] = url.pathname.split("/").filter(Boolean);
  const candidate =
    url.hostname.toLowerCase() === "youtu.be"
      ? first
      : first === "watch"
        ? url.searchParams.get("v")
        : ["shorts", "embed", "live", "v"].includes(first ?? "")
          ? second
          : null;
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}
