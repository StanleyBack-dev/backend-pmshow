import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, type Repository } from "typeorm";
import type {
  SongData,
  SongFilter,
  SongRepositoryPort,
} from "@/modules/repertoire/application/ports/song-repository.port";
import type { Song } from "@/modules/repertoire/domain/song";
import { SongOrmEntity } from "@/modules/repertoire/infrastructure/persistence/typeorm/entities/song.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const toSong = (row: SongOrmEntity): Song => ({
  id: row.id,
  title: row.title,
  artistId: row.artistId,
  stage: row.stage,
  arranger: row.arranger,
  category: row.category,
  musicalKey: row.musicalKey,
  bpm: row.bpm,
  durationSeconds: row.durationSeconds,
  lyrics: row.lyrics,
  notes: row.notes,
  tags: row.tags ?? [],
  archivedAt: row.archivedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

@Injectable()
export class SongTypeormRepository implements SongRepositoryPort {
  constructor(
    @InjectRepository(SongOrmEntity)
    private readonly repository: Repository<SongOrmEntity>,
  ) {}

  async list(filter: SongFilter, page: PageRequest): Promise<Paginated<Song>> {
    const query = this.repository
      .createQueryBuilder("song")
      .leftJoin(
        "tb_artists",
        "artist",
        "artist.idtb_artists = song.idtb_artists",
      )
      .where(
        filter.archived
          ? "song.archived_at IS NOT NULL"
          : "song.archived_at IS NULL",
      )
      .orderBy("song.title", "ASC")
      .skip((page.page - 1) * page.limit)
      .take(page.limit);

    const search = filter.search?.trim();
    if (search) {
      // unaccent: "hino" finds "Hino Nacional", "cancao" finds "canção".
      const term = `%${escapeLike(search)}%`;
      query.andWhere(
        new Brackets((where) =>
          where
            .where("unaccent(song.title) ILIKE unaccent(:term)", { term })
            .orWhere(
              "unaccent(coalesce(artist.name, '')) ILIKE unaccent(:term)",
              { term },
            ),
        ),
      );
    }
    if (filter.title?.trim()) {
      query.andWhere("lower(unaccent(song.title)) = lower(unaccent(:title))", {
        title: filter.title.trim(),
      });
    }
    if (filter.artistId) {
      query.andWhere("song.idtb_artists = :artistId", filter);
    }
    if (filter.stage) {
      query.andWhere("song.stage = :stage", filter);
    }
    if (filter.category) {
      query.andWhere("song.category = :category", filter);
    }
    if (filter.tag) {
      query.andWhere(":tag = ANY(song.tags)", { tag: filter.tag });
    }

    const [rows, total] = await query.getManyAndCount();
    return paginate(rows.map(toSong), total, page);
  }

  async findById(id: string): Promise<Song | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toSong(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Song[]> {
    if (ids.length === 0) return [];
    const rows = await this.repository.find({ where: { id: In([...ids]) } });
    return rows.map(toSong);
  }

  async create(data: SongData, createdBy: string): Promise<Song> {
    const saved = await this.repository.save(
      this.repository.create({ ...data, createdBy }),
    );
    return toSong(saved);
  }

  async update(id: string, data: Partial<SongData>): Promise<Song> {
    await this.repository.update({ id }, data);
    return toSong(await this.repository.findOneOrFail({ where: { id } }));
  }

  async setArchived(id: string, archivedAt: Date | null): Promise<Song> {
    await this.repository.update({ id }, { archivedAt });
    return toSong(await this.repository.findOneOrFail({ where: { id } }));
  }

  async listTitles(archived: boolean): Promise<string[]> {
    const rows = await this.repository.query<{ title: string }[]>(
      `SELECT DISTINCT ON (lower(unaccent(title))) title FROM tb_songs
        WHERE ${archived ? "archived_at IS NOT NULL" : "archived_at IS NULL"}
        ORDER BY lower(unaccent(title)), title`,
    );
    return rows.map((row) => row.title);
  }

  async listTags(): Promise<string[]> {
    const rows = await this.repository.query<{ tag: string }[]>(
      `SELECT DISTINCT unnest(tags) AS tag FROM tb_songs
        WHERE archived_at IS NULL ORDER BY tag`,
    );
    return rows.map((row) => row.tag);
  }
}
