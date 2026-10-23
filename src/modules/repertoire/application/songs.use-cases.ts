import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
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
  normalizeTags,
  type Song,
  type SongCategory,
} from "@/modules/repertoire/domain/song";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type SongInput = {
  title: string;
  artist?: string | null;
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
  ) {}

  list(filter: SongFilter, page: PageRequest): Promise<Paginated<Song>> {
    return this.songs.list(filter, page);
  }

  listTags(): Promise<string[]> {
    return this.songs.listTags();
  }

  async get(id: string): Promise<Song> {
    const song = await this.songs.findById(id);
    if (!song) {
      throw AppException.from(APP_ERRORS.repertoire.songNotFound, undefined);
    }
    return song;
  }

  /** Throws unless the song exists and is not archived (used by media). */
  async getActive(id: string): Promise<Song> {
    const song = await this.get(id);
    if (song.archivedAt) {
      throw AppException.from(APP_ERRORS.repertoire.songArchived, undefined);
    }
    return song;
  }

  async create(actor: AuthenticatedUser, input: SongInput): Promise<Song> {
    const song = await this.songs.create(this.toData(input), actor.id);
    await this.record(actor, "song.created", song.id, { title: song.title });
    return song;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: SongInput,
  ): Promise<Song> {
    const before = await this.getActive(id);
    const song = await this.songs.update(id, this.toData(input));
    await this.record(
      actor,
      "song.updated",
      id,
      { title: song.title },
      {
        title: before.title,
      },
    );
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
    await this.record(actor, archived ? "song.archived" : "song.restored", id, {
      title: song.title,
    });
    return song;
  }

  private toData(input: SongInput): SongData {
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

    return {
      title: input.title.trim().replace(/\s+/g, " "),
      artist: text(input.artist),
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

  private record(
    actor: AuthenticatedUser,
    action: string,
    id: string,
    after: Record<string, unknown>,
    before?: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action,
      entity: "song",
      entityId: id,
      before,
      after,
    });
  }
}
