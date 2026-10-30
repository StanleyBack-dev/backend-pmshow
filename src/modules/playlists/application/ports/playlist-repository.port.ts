import type { Playlist } from "@/modules/playlists/domain/playlist";

export type PlaylistView = Playlist & { ownerName: string };

export type NewPlaylist = Omit<Playlist, "id" | "createdAt" | "updatedAt">;

export interface PlaylistRepositoryPort {
  /** The person's playlists and the ones shared with the band (newest first). */
  listVisible(userId: string): Promise<PlaylistView[]>;
  findById(id: string): Promise<PlaylistView | null>;
  create(playlist: NewPlaylist): Promise<PlaylistView>;
  /** Replaces the data and the items (in order) in one transaction. */
  update(
    id: string,
    data: Pick<Playlist, "name" | "description" | "shared" | "items">,
  ): Promise<PlaylistView>;
  delete(id: string): Promise<void>;
}

export const PLAYLIST_REPOSITORY = Symbol("PLAYLIST_REPOSITORY");
