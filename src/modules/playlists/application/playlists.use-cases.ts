import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  PLAYLIST_REPOSITORY,
  type PlaylistRepositoryPort,
  type PlaylistView,
} from "@/modules/playlists/application/ports/playlist-repository.port";
import {
  PLAYLIST_LIMITS,
  canSee,
  normalizePlaylist,
  type PlaylistDraft,
  type PlaylistViolation,
} from "@/modules/playlists/domain/playlist";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";

const VIOLATION_MESSAGES: Record<PlaylistViolation, string> = {
  "name-required": "Dê um nome à playlist (pelo menos 2 caracteres).",
  "name-too-long": `O nome pode ter até ${PLAYLIST_LIMITS.name} caracteres.`,
  "description-too-long": `A descrição pode ter até ${PLAYLIST_LIMITS.description} caracteres.`,
  "too-many-songs": `Uma playlist pode ter até ${PLAYLIST_LIMITS.songs} músicas.`,
};

@Injectable()
export class PlaylistsUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY)
    private readonly playlists: PlaylistRepositoryPort,
    private readonly songs: SongsUseCase,
    private readonly audit: AuditTrailService,
  ) {}

  list(actor: AuthenticatedUser): Promise<PlaylistView[]> {
    return this.playlists.listVisible(actor.id);
  }

  async get(actor: AuthenticatedUser, id: string): Promise<PlaylistView> {
    const playlist = await this.playlists.findById(id);
    if (!playlist || !canSee(playlist, actor.id)) {
      throw AppException.from(APP_ERRORS.playlists.notFound, undefined);
    }
    return playlist;
  }

  async create(
    actor: AuthenticatedUser,
    draft: PlaylistDraft,
  ): Promise<PlaylistView> {
    const value = await this.valid(draft);
    const created = await this.playlists.create({
      ...value,
      ownerId: actor.id,
    });
    await this.stamp(actor, created.id, true);
    return created;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    draft: PlaylistDraft,
  ): Promise<PlaylistView> {
    await this.owned(actor, id);
    const updated = await this.playlists.update(id, await this.valid(draft));
    await this.stamp(actor, id);
    return updated;
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.owned(actor, id);
    await this.playlists.delete(id);
  }

  private async owned(actor: AuthenticatedUser, id: string) {
    const playlist = await this.get(actor, id);
    if (playlist.ownerId !== actor.id) {
      throw AppException.from(APP_ERRORS.playlists.notOwner, undefined);
    }
    return playlist;
  }

  // Clean draft whose songs exist and are not archived.
  private async valid(draft: PlaylistDraft) {
    const result = normalizePlaylist(draft);
    if (!result.ok) {
      throw AppException.from(APP_ERRORS.playlists.invalid, {
        reason: VIOLATION_MESSAGES[result.violation],
      });
    }
    const found = await this.songs.findMany(result.value.songIds);
    const usable = new Set(
      found.filter((song) => !song.archivedAt).map((song) => song.id),
    );
    if (result.value.songIds.some((id) => !usable.has(id))) {
      throw AppException.from(APP_ERRORS.playlists.unknownSongs, undefined);
    }
    return result.value;
  }

  private stamp(
    actor: AuthenticatedUser,
    id: string,
    created = false,
  ): Promise<void> {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "playlist",
      entityId: id,
      created,
    });
  }
}
