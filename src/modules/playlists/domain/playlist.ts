// A playlist of the repertoire (rehearsal mode): the songs in the order the
// player goes through them. Each person keeps their own; one shared with the
// band can be played by everyone, but only its owner changes it.

export const PLAYLIST_LIMITS = { name: 80, description: 300, songs: 200 };

export type Playlist = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  shared: boolean;
  /** Song ids in play order. */
  songIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type PlaylistDraft = {
  name: string;
  description?: string | null;
  shared: boolean;
  songIds: readonly string[];
};

export type PlaylistViolation =
  "name-required" | "name-too-long" | "description-too-long" | "too-many-songs";

/** The draft cleaned (trimmed, songs without repeats) or what is wrong. */
export function normalizePlaylist(draft: PlaylistDraft):
  | {
      ok: true;
      value: {
        name: string;
        description: string | null;
        shared: boolean;
        songIds: string[];
      };
    }
  | { ok: false; violation: PlaylistViolation } {
  const name = draft.name.trim().replace(/\s+/g, " ");
  const description = draft.description?.trim() || null;
  const songIds = [...new Set(draft.songIds)];
  if (name.length < 2) return { ok: false, violation: "name-required" };
  if (name.length > PLAYLIST_LIMITS.name) {
    return { ok: false, violation: "name-too-long" };
  }
  if (description && description.length > PLAYLIST_LIMITS.description) {
    return { ok: false, violation: "description-too-long" };
  }
  if (songIds.length > PLAYLIST_LIMITS.songs) {
    return { ok: false, violation: "too-many-songs" };
  }
  return {
    ok: true,
    value: { name, description, shared: draft.shared, songIds },
  };
}

/** Who may see it: its owner, or everyone when shared. */
export const canSee = (playlist: Playlist, userId: string) =>
  playlist.shared || playlist.ownerId === userId;
