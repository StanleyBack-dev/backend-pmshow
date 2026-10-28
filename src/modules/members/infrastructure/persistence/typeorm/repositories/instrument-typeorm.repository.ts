import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import type {
  InstrumentFilter,
  InstrumentRepositoryPort,
} from "@/modules/members/application/ports/instrument-repository.port";
import type {
  Instrument,
  InstrumentListItem,
  Section,
} from "@/modules/members/domain/member";
import { InstrumentOrmEntity } from "@/modules/members/infrastructure/persistence/typeorm/entities/member.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

// Members whose band profile lists the instrument.
const MEMBER_COUNT = `(SELECT count(*) FROM tb_member_instruments mi
  WHERE mi.idtb_instruments = instrument.idtb_instruments)`;

const toInstrument = (row: InstrumentOrmEntity): Instrument => ({
  id: row.id,
  name: row.name,
  section: row.section,
  archived: row.archived,
});

@Injectable()
export class InstrumentTypeormRepository implements InstrumentRepositoryPort {
  constructor(
    @InjectRepository(InstrumentOrmEntity)
    private readonly repository: Repository<InstrumentOrmEntity>,
  ) {}

  async list(includeArchived: boolean): Promise<Instrument[]> {
    const rows = await this.repository.find({
      where: includeArchived ? {} : { archived: false },
      order: { section: "ASC", name: "ASC" },
    });
    return rows.map(toInstrument);
  }

  async page(
    filter: InstrumentFilter,
    page: PageRequest,
  ): Promise<Paginated<InstrumentListItem>> {
    const query = this.repository
      .createQueryBuilder("instrument")
      .addSelect(MEMBER_COUNT, "member_count")
      .where("instrument.archived = :archived", { archived: filter.archived })
      .orderBy("instrument.section", "ASC")
      .addOrderBy("instrument.name", "ASC")
      .offset((page.page - 1) * page.limit)
      .limit(page.limit);

    const search = filter.search?.trim();
    if (search) {
      query.andWhere("unaccent(instrument.name) ILIKE unaccent(:term)", {
        term: `%${escapeLike(search)}%`,
      });
    }
    if (filter.section) {
      query.andWhere("instrument.section = :section", {
        section: filter.section,
      });
    }

    const [{ entities, raw }, total] = await Promise.all([
      query.getRawAndEntities<{ member_count: string }>(),
      query.getCount(),
    ]);
    const items = entities.map((row, index) => ({
      ...toInstrument(row),
      memberCount: Number(raw[index]?.member_count ?? 0),
    }));
    return paginate(items, total, page);
  }

  async findByIds(ids: readonly string[]): Promise<Instrument[]> {
    if (ids.length === 0) return [];
    const rows = await this.repository.find({ where: { id: In([...ids]) } });
    return rows.map(toInstrument);
  }

  async findById(id: string): Promise<Instrument | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toInstrument(row) : null;
  }

  async findByName(name: string): Promise<Instrument | null> {
    const row = await this.repository
      .createQueryBuilder("instrument")
      .where("lower(instrument.name) = lower(:name)", { name })
      .getOne();
    return row ? toInstrument(row) : null;
  }

  async create(data: { name: string; section: Section }): Promise<Instrument> {
    return toInstrument(
      await this.repository.save(this.repository.create(data)),
    );
  }

  async update(
    id: string,
    patch: Partial<Pick<Instrument, "name" | "section" | "archived">>,
  ): Promise<Instrument> {
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }
    return toInstrument(await this.repository.findOneOrFail({ where: { id } }));
  }
}
