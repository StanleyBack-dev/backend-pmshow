import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { ArtistsUseCase } from "@/modules/artists/application/artists.use-cases";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  SONG_REPOSITORY,
  type SongData,
  type SongFilter,
  type SongRepositoryPort,
} from "@/modules/repertoire/application/ports/song-repository.port";
import {
  BPM_RANGE,
  DURATION_RANGE,
  inRange,
  normalizeMusicalKey,
  normalizeSongTitle,
  normalizeTags,
  SongStage,
  type Song,
  type SongCategory,
} from "@/modules/repertoire/domain/song";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type SongInput = {
  title: string;
  artistId?: string | null;
  stage?: SongStage | null;
  arranger?: string | null;
  category: SongCategory;
  musicalKey?: string | null;
  bpm?: number | null;
  durationSeconds?: number | null;
  lyrics?: string | null;
  notes?: string | null;
  tags?: string[];
};

const text = (value: string | null | undefined) => value?.trim() || null;

@Injectable()
export class SongsUseCase {
  constructor(
    @Inject(SONG_REPOSITORY) private readonly songs: SongRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly audit: AuditTrailService,
    private readonly artists: ArtistsUseCase,
  ) {}

  list(filter: SongFilter, page: PageRequest): Promise<Paginated<Song>> {
    return this.songs.list(filter, page);
  }

  listTags(): Promise<string[]> {
    return this.songs.listTags();
  }

  listTitles(archived: boolean): Promise<string[]> {
    return this.songs.listTitles(archived);
  }

  async get(id: string): Promise<Song> {
    const song = await this.songs.findById(id);
    if (!song) {
      throw AppException.from(APP_ERRORS.repertoire.songNotFound, undefined);
    }
    return song;
  }

  /**
   * Sets the duration from a media file / video when the song has none yet
   * (used by media: the first audio or video defines it).
   */
  async fillDurationIfMissing(
    id: string,
    seconds: number | null,
  ): Promise<void> {
    if (seconds == null || !inRange(seconds, DURATION_RANGE)) return;
    const song = await this.songs.findById(id);
    if (!song || song.durationSeconds != null) return;
    await this.songs.update(id, { durationSeconds: seconds });
  }

  /** Throws unless the song exists and is not archived (used by media). */
  async getActive(id: string): Promise<Song> {
    const song = await this.get(id);
    if (song.archivedAt) {
      throw AppException.from(APP_ERRORS.repertoire.songArchived, undefined);
    }
    return song;
  }

  /** The songs that exist, in no particular order (archived included). */
  findMany(ids: readonly string[]): Promise<Song[]> {
    return this.songs.findByIds(ids);
  }

  async create(actor: AuthenticatedUser, input: SongInput): Promise<Song> {
    const song = await this.songs.create(await this.toData(input), actor.id);
    await this.stamp(actor, song.id, true);
    return song;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: SongInput,
  ): Promise<Song> {
    const before = await this.getActive(id);
    const song = await this.songs.update(
      id,
      await this.toData(input, before.artistId),
    );
    await this.stamp(actor, id);
    return song;
  }

  async setArchived(
    actor: AuthenticatedUser,
    id: string,
    archived: boolean,
  ): Promise<Song> {
    const current = await this.get(id);
    if (Boolean(current.archivedAt) === archived) return current;
    const song = await this.songs.setArchived(
      id,
      archived ? this.clock.now() : null,
    );
    await this.stamp(actor, id);
    return song;
  }

  /** `currentArtistId`: an archived artist the song already had is kept. */
  private async toData(
    input: SongInput,
    currentArtistId: string | null = null,
  ): Promise<SongData> {
    let musicalKey: string | null = null;
    if (input.musicalKey?.trim()) {
      musicalKey = normalizeMusicalKey(input.musicalKey);
      if (!musicalKey) {
        throw AppException.from(APP_ERRORS.repertoire.invalidKey, undefined);
      }
    }
    if (input.bpm != null && !inRange(input.bpm, BPM_RANGE)) {
      throw AppException.from(APP_ERRORS.repertoire.invalidBpm, undefined);
    }
    if (
      input.durationSeconds != null &&
      !inRange(input.durationSeconds, DURATION_RANGE)
    ) {
      throw AppException.from(APP_ERRORS.repertoire.invalidDuration, undefined);
    }

    // Every song has a singer / band (title and artist go together).
    const artistId = input.artistId ?? null;
    if (!artistId) {
      throw AppException.from(APP_ERRORS.repertoire.artistRequired, undefined);
    }
    if (artistId !== currentArtistId) {
      await this.artists.getActive(artistId);
    }

    return {
      title: normalizeSongTitle(input.title),
      artistId,
      stage: input.stage ?? SongStage.CONHECIDA,
      arranger: text(input.arranger),
      category: input.category,
      musicalKey,
      bpm: input.bpm ?? null,
      durationSeconds: input.durationSeconds ?? null,
      lyrics: text(input.lyrics),
      notes: text(input.notes),
      tags: normalizeTags(input.tags ?? []),
    };
  }

  private stamp(
    actor: AuthenticatedUser,
    id: string,
    created = false,
  ): Promise<void> {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "song",
      entityId: id,
      created,
    });
  }
}
