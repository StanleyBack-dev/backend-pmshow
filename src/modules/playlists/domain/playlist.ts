import { isYoutubeVideoId } from "@/modules/media/domain/media";

// A playlist of the repertoire (rehearsal mode): what the player goes
// through, in order. Each person keeps their own; one shared with the band
// can be played by everyone, but only its owner changes it.
// Besides songs of the repertoire it may hold YouTube videos found while
// building it: those belong to the playlist only (they are not songs, so
// events, rosters and the repertoire never see them).

export const PLAYLIST_LIMITS = {
  name: 80,
  description: 300,
  items: 200,
  videoTitle: 200,
  videoChannel: 120,
};

/** A YouTube video kept in the playlist itself. */
export type PlaylistVideo = {
  videoId: string;
  title: string;
  channelTitle: string | null;
};

/** One line of the playlist: a song of the repertoire or a video. */
export type PlaylistItem =
  { kind: "song"; songId: string } | { kind: "video"; video: PlaylistVideo };

export type Playlist = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  shared: boolean;
  /** In play order. */
  items: PlaylistItem[];
  createdAt: Date;
  updatedAt: Date;
};

export type PlaylistDraft = {
  name: string;
  description?: string | null;
  shared: boolean;
  items: readonly PlaylistItem[];
};

export type PlaylistViolation =
  | "name-required"
  | "name-too-long"
  | "description-too-long"
  | "too-many-items"
  | "invalid-video";

const clean = (value: string) => value.trim().replace(/\s+/g, " ");

/** The video trimmed, or null when it is not a usable one. */
function normalizeVideo(video: PlaylistVideo): PlaylistVideo | null {
  const title = clean(video.title);
  const channelTitle = video.channelTitle ? clean(video.channelTitle) : "";
  if (
    !isYoutubeVideoId(video.videoId) ||
    !title ||
    title.length > PLAYLIST_LIMITS.videoTitle ||
    channelTitle.length > PLAYLIST_LIMITS.videoChannel
  ) {
    return null;
  }
  return { videoId: video.videoId, title, channelTitle: channelTitle || null };
}

/**
 * The draft cleaned (trimmed; each song or video once, where it first
 * appears) or what is wrong.
 */
export function normalizePlaylist(draft: PlaylistDraft):
  | {
      ok: true;
      value: {
        name: string;
        description: string | null;
        shared: boolean;
        items: PlaylistItem[];
      };
    }
  | { ok: false; violation: PlaylistViolation } {
  const name = clean(draft.name);
  const description = draft.description?.trim() || null;
  if (name.length < 2) return { ok: false, violation: "name-required" };
  if (name.length > PLAYLIST_LIMITS.name) {
    return { ok: false, violation: "name-too-long" };
  }
  if (description && description.length > PLAYLIST_LIMITS.description) {
    return { ok: false, violation: "description-too-long" };
  }

  const seen = new Set<string>();
  const items: PlaylistItem[] = [];
  for (const item of draft.items) {
    let next: PlaylistItem;
    if (item.kind === "video") {
      const video = normalizeVideo(item.video);
      if (!video) return { ok: false, violation: "invalid-video" };
      next = { kind: "video", video };
    } else {
      next = item;
    }
    const key = next.kind === "song" ? next.songId : `yt:${next.video.videoId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(next);
  }
  if (items.length > PLAYLIST_LIMITS.items) {
    return { ok: false, violation: "too-many-items" };
  }
  return {
    ok: true,
    value: { name, description, shared: draft.shared, items },
  };
}

/** The repertoire songs of the items, in order. */
export const playlistSongIds = (items: readonly PlaylistItem[]): string[] =>
  items.flatMap((item) => (item.kind === "song" ? [item.songId] : []));

/** Who may see it: its owner, or everyone when shared. */
export const canSee = (playlist: Playlist, userId: string) =>
  playlist.shared || playlist.ownerId === userId;
