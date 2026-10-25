import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import type {
  ArtistFilter,
  ArtistRepositoryPort,
} from "@/modules/artists/application/ports/artist-repository.port";
import type { Artist, ArtistListItem } from "@/modules/artists/domain/artist";
import { ArtistOrmEntity } from "@/modules/artists/infrastructure/persistence/typeorm/artist.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

// Songs still in the repertoire that point to the artist.
const SONG_COUNT = `(SELECT count(*) FROM tb_songs s
  WHERE s.idtb_artists = artist.idtb_artists AND s.archived_at IS NULL)`;

const toArtist = (row: ArtistOrmEntity): Artist => ({
  id: row.id,
  name: row.name,
  archived: row.archived,
  createdAt: row.createdAt,
});

@Injectable()
export class ArtistTypeormRepository implements ArtistRepositoryPort {
  constructor(
    @InjectRepository(ArtistOrmEntity)
    private readonly repository: Repository<ArtistOrmEntity>,
  ) {}

  async list(includeArchived: boolean): Promise<Artist[]> {
    const rows = await this.repository.find({
      where: includeArchived ? {} : { archived: false },
      order: { nameKey: "ASC" },
    });
    return rows.map(toArtist);
  }

  async page(
    filter: ArtistFilter,
    page: PageRequest,
  ): Promise<Paginated<ArtistListItem>> {
    const query = this.repository
      .createQueryBuilder("artist")
      .addSelect(SONG_COUNT, "song_count")
      .where("artist.archived = :archived", { archived: filter.archived })
      .orderBy("artist.name_key", "ASC")
      .offset((page.page - 1) * page.limit)
      .limit(page.limit);

    const search = filter.search?.trim();
    if (search) {
      query.andWhere("unaccent(artist.name) ILIKE unaccent(:term)", {
        term: `%${escapeLike(search)}%`,
      });
    }
    if (filter.withSongs !== undefined) {
      query.andWhere(`${SONG_COUNT} ${filter.withSongs ? ">" : "="} 0`);
    }

    const [{ entities, raw }, total] = await Promise.all([
      query.getRawAndEntities<{ song_count: string }>(),
      query.getCount(),
    ]);
    const items = entities.map((row, index) => ({
      ...toArtist(row),
      songCount: Number(raw[index]?.song_count ?? 0),
    }));
    return paginate(items, total, page);
  }

  async findById(id: string): Promise<Artist | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toArtist(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Artist[]> {
    if (ids.length === 0) return [];
    const rows = await this.repository.find({ where: { id: In([...ids]) } });
    return rows.map(toArtist);
  }

  async findByKey(key: string): Promise<Artist | null> {
    const row = await this.repository.findOne({ where: { nameKey: key } });
    return row ? toArtist(row) : null;
  }

  async create(name: string, key: string, createdBy: string): Promise<Artist> {
    const saved = await this.repository.save(
      this.repository.create({ name, nameKey: key, createdBy }),
    );
    return toArtist(saved);
  }

  async update(
    id: string,
    patch: { name?: string; key?: string; archived?: boolean },
  ): Promise<Artist> {
    await this.repository.update(
      { id },
      {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.key !== undefined && { nameKey: patch.key }),
        ...(patch.archived !== undefined && { archived: patch.archived }),
      },
    );
    return toArtist(await this.repository.findOneOrFail({ where: { id } }));
  }
}
