import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import type { InstrumentRepositoryPort } from "@/modules/members/application/ports/instrument-repository.port";
import type { Instrument, Section } from "@/modules/members/domain/member";
import { InstrumentOrmEntity } from "@/modules/members/infrastructure/persistence/typeorm/entities/member.orm-entity";

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
