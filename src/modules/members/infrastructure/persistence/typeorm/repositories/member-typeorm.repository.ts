import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type {
  MemberProfileData,
  MemberRepositoryPort,
  RosterEntry,
  RosterFilter,
} from "@/modules/members/application/ports/member-repository.port";
import type {
  MemberFunction,
  MemberInstrument,
  MemberProfile,
} from "@/modules/members/domain/member";
import {
  MemberFunctionOrmEntity,
  MemberInstrumentOrmEntity,
  MemberOrmEntity,
} from "@/modules/members/infrastructure/persistence/typeorm/entities/member.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

type RosterRow = {
  user_id: string;
  name: string;
  username: string;
  active: boolean;
  war_name: string | null;
  rank: MemberProfile["rank"] | null;
  registration: string | null;
  phone: string | null;
  section: MemberProfile["section"] | null;
  status: MemberProfile["status"] | null;
  notes: string | null;
  updated_at: Date | null;
};

type FunctionRow = {
  user_id: string;
  function_id: string;
  name: string;
};

type InstrumentRow = {
  user_id: string;
  instrument_id: string;
  name: string;
  is_primary: boolean;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

// Reads tb_users (owned by identity) only to list everyone with an account,
// with or without a band profile; it never writes there.
@Injectable()
export class MemberTypeormRepository implements MemberRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listRoster(
    filter: RosterFilter,
    page: PageRequest,
  ): Promise<Paginated<RosterEntry>> {
    const params: unknown[] = [];
    const where: string[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    const search = filter.search?.trim();
    if (search) {
      const term = param(`%${escapeLike(search)}%`);
      where.push(
        `(u.name ILIKE ${term} OR u.username ILIKE ${term} OR m.war_name ILIKE ${term} OR m.registration ILIKE ${term})`,
      );
    }
    if (filter.section) where.push(`m.section = ${param(filter.section)}`);
    if (filter.status) where.push(`m.status = ${param(filter.status)}`);
    if (filter.instrumentId) {
      where.push(
        `EXISTS (SELECT 1 FROM tb_member_instruments mi WHERE mi.idtb_users = u.idtb_users AND mi.idtb_instruments = ${param(filter.instrumentId)})`,
      );
    }
    if (filter.functionId) {
      where.push(
        `EXISTS (SELECT 1 FROM tb_member_functions mf WHERE mf.idtb_users = u.idtb_users AND mf.idtb_band_functions = ${param(filter.functionId)})`,
      );
    }
    if (filter.withProfile !== undefined) {
      where.push(
        filter.withProfile
          ? "m.idtb_users IS NOT NULL"
          : "m.idtb_users IS NULL",
      );
    }

    const from = `FROM tb_users u LEFT JOIN tb_members m ON m.idtb_users = u.idtb_users
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const countParams = [...params];
    const limit = param(page.limit);
    const offset = param((page.page - 1) * page.limit);

    const [rows, counted] = await Promise.all([
      this.dataSource.query<RosterRow[]>(
        `SELECT u.idtb_users AS user_id, u.name, u.username, u.active,
                m.war_name, m.rank, m.registration, m.phone, m.section,
                m.status, m.notes, m.updated_at
           ${from}
          ORDER BY u.active DESC, coalesce(m.war_name, upper(u.name))
          LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total ${from}`,
        countParams,
      ),
    ]);

    const withProfile = rows
      .filter((row) => row.war_name !== null)
      .map((row) => row.user_id);
    const [instruments, functions] = await Promise.all([
      this.instrumentsOf(withProfile),
      this.functionsOf(withProfile),
    ]);
    const items = rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      username: row.username,
      active: row.active,
      profile:
        row.war_name === null ? null : toProfile(row, instruments, functions),
    }));
    return paginate(items, counted[0]?.total ?? 0, page);
  }

  async findProfile(userId: string): Promise<MemberProfile | null> {
    const rows = await this.dataSource.query<RosterRow[]>(
      `SELECT m.idtb_users AS user_id, m.war_name, m.rank, m.registration,
              m.phone, m.section, m.status, m.notes, m.updated_at
         FROM tb_members m WHERE m.idtb_users = $1`,
      [userId],
    );
    if (!rows[0]) return null;
    const [instruments, functions] = await Promise.all([
      this.instrumentsOf([userId]),
      this.functionsOf([userId]),
    ]);
    return toProfile(rows[0], instruments, functions);
  }

  async findUserIdByRegistration(registration: string): Promise<string | null> {
    const row = await this.dataSource
      .getRepository(MemberOrmEntity)
      .findOne({ where: { registration }, select: { userId: true } });
    return row?.userId ?? null;
  }

  async saveProfile(
    userId: string,
    data: MemberProfileData,
  ): Promise<MemberProfile> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.getRepository(MemberOrmEntity).save({
        userId,
        warName: data.warName,
        rank: data.rank,
        registration: data.registration,
        phone: data.phone,
        section: data.section,
        status: data.status,
        notes: data.notes,
      });
      const links = manager.getRepository(MemberInstrumentOrmEntity);
      await links.delete({ userId });
      if (data.instruments.length > 0) {
        await links.insert(
          data.instruments.map((item) => ({
            userId,
            instrumentId: item.instrumentId,
            primary: item.primary,
          })),
        );
      }
      if (data.functionIds !== undefined) {
        const functions = manager.getRepository(MemberFunctionOrmEntity);
        await functions.delete({ userId });
        if (data.functionIds.length > 0) {
          await functions.insert(
            data.functionIds.map((functionId) => ({ userId, functionId })),
          );
        }
      }
    });
    const saved = await this.findProfile(userId);
    if (!saved) throw new Error(`Member profile ${userId} vanished after save`);
    return saved;
  }

  private async instrumentsOf(
    userIds: string[],
  ): Promise<Map<string, MemberInstrument[]>> {
    const byUser = new Map<string, MemberInstrument[]>();
    if (userIds.length === 0) return byUser;
    const rows = await this.dataSource.query<InstrumentRow[]>(
      `SELECT mi.idtb_users AS user_id, i.idtb_instruments AS instrument_id,
              i.name, mi.is_primary
         FROM tb_member_instruments mi
         JOIN tb_instruments i ON i.idtb_instruments = mi.idtb_instruments
        WHERE mi.idtb_users = ANY($1::uuid[])
        ORDER BY mi.is_primary DESC, i.name`,
      [userIds],
    );
    for (const row of rows) {
      const list = byUser.get(row.user_id) ?? [];
      list.push({
        instrumentId: row.instrument_id,
        name: row.name,
        primary: row.is_primary,
      });
      byUser.set(row.user_id, list);
    }
    return byUser;
  }

  private async functionsOf(
    userIds: string[],
  ): Promise<Map<string, MemberFunction[]>> {
    const byUser = new Map<string, MemberFunction[]>();
    if (userIds.length === 0) return byUser;
    const rows = await this.dataSource.query<FunctionRow[]>(
      `SELECT mf.idtb_users AS user_id, f.idtb_band_functions AS function_id,
              f.name
         FROM tb_member_functions mf
         JOIN tb_band_functions f
           ON f.idtb_band_functions = mf.idtb_band_functions
        WHERE mf.idtb_users = ANY($1::uuid[])
        ORDER BY f.name`,
      [userIds],
    );
    for (const row of rows) {
      const list = byUser.get(row.user_id) ?? [];
      list.push({ functionId: row.function_id, name: row.name });
      byUser.set(row.user_id, list);
    }
    return byUser;
  }
}

function toProfile(
  row: RosterRow,
  instruments: Map<string, MemberInstrument[]>,
  functions: Map<string, MemberFunction[]>,
): MemberProfile {
  return {
    userId: row.user_id,
    warName: row.war_name as string,
    rank: row.rank as MemberProfile["rank"],
    registration: row.registration,
    phone: row.phone,
    section: row.section as MemberProfile["section"],
    status: row.status as MemberProfile["status"],
    notes: row.notes,
    instruments: instruments.get(row.user_id) ?? [],
    functions: functions.get(row.user_id) ?? [],
    updatedAt: row.updated_at as Date,
  };
}
