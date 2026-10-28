import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import type {
  BandFunctionFilter,
  BandFunctionRepositoryPort,
} from "@/modules/band-functions/application/ports/band-function-repository.port";
import type {
  BandFunction,
  BandFunctionListItem,
} from "@/modules/band-functions/domain/band-function";
import { BandFunctionOrmEntity } from "@/modules/band-functions/infrastructure/persistence/typeorm/band-function.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

// Members whose band profile lists the function.
const MEMBER_COUNT = `(SELECT count(*) FROM tb_member_functions mf
  WHERE mf.idtb_band_functions = fn.idtb_band_functions)`;

const toFunction = (row: BandFunctionOrmEntity): BandFunction => ({
  id: row.id,
  name: row.name,
  archived: row.archived,
});

@Injectable()
export class BandFunctionTypeormRepository implements BandFunctionRepositoryPort {
  constructor(
    @InjectRepository(BandFunctionOrmEntity)
    private readonly repository: Repository<BandFunctionOrmEntity>,
  ) {}

  async list(includeArchived: boolean): Promise<BandFunction[]> {
    const rows = await this.repository.find({
      where: includeArchived ? {} : { archived: false },
      order: { name: "ASC" },
    });
    return rows.map(toFunction);
  }

  async page(
    filter: BandFunctionFilter,
    page: PageRequest,
  ): Promise<Paginated<BandFunctionListItem>> {
    const query = this.repository
      .createQueryBuilder("fn")
      .addSelect(MEMBER_COUNT, "member_count")
      .where("fn.archived = :archived", { archived: filter.archived })
      .orderBy("fn.name", "ASC")
      .offset((page.page - 1) * page.limit)
      .limit(page.limit);

    const search = filter.search?.trim();
    if (search) {
      query.andWhere("unaccent(fn.name) ILIKE unaccent(:term)", {
        term: `%${escapeLike(search)}%`,
      });
    }

    const [{ entities, raw }, total] = await Promise.all([
      query.getRawAndEntities<{ member_count: string }>(),
      query.getCount(),
    ]);
    const items = entities.map((row, index) => ({
      ...toFunction(row),
      memberCount: Number(raw[index]?.member_count ?? 0),
    }));
    return paginate(items, total, page);
  }

  async findByIds(ids: readonly string[]): Promise<BandFunction[]> {
    if (ids.length === 0) return [];
    const rows = await this.repository.find({ where: { id: In([...ids]) } });
    return rows.map(toFunction);
  }

  async findById(id: string): Promise<BandFunction | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toFunction(row) : null;
  }

  async findByName(name: string): Promise<BandFunction | null> {
    const row = await this.repository
      .createQueryBuilder("fn")
      .where("lower(fn.name) = lower(:name)", { name })
      .getOne();
    return row ? toFunction(row) : null;
  }

  async create(data: { name: string }): Promise<BandFunction> {
    return toFunction(await this.repository.save(this.repository.create(data)));
  }

  async update(
    id: string,
    patch: Partial<Pick<BandFunction, "name" | "archived">>,
  ): Promise<BandFunction> {
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }
    return toFunction(await this.repository.findOneOrFail({ where: { id } }));
  }
}
