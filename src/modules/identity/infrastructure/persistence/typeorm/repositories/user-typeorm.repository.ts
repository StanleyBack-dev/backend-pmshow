import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Brackets, type DataSource, type Repository } from "typeorm";
import type { UserGroup } from "@/modules/access-control/domain/user-group";
import type {
  NewCredential,
  NewUser,
  UserAccount,
  UserFilter,
  UserPatch,
  UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import type { User } from "@/modules/identity/domain/user";
import { CredentialOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/credential.orm-entity";
import { UserOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/user.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const toUser = (row: UserOrmEntity): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  username: row.username,
  group: row.group,
  active: row.active,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deactivatedAt: row.deactivatedAt,
  lastLoginAt: row.lastLoginAt,
  avatarKey: row.avatarKey,
});

type AccountRaw = {
  credential_must_change_password: boolean | null;
  credential_locked_until: Date | null;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

@Injectable()
export class UserTypeormRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toUser(row) : null;
  }

  findByLogin(login: string): Promise<User | null> {
    return login.includes("@")
      ? this.findByEmail(login)
      : this.findByUsername(login);
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = await this.repository.findOne({ where: { username } });
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repository
      .createQueryBuilder("user")
      .where("lower(user.email) = lower(:email)", { email })
      .getOne();
    return row ? toUser(row) : null;
  }

  async findAccount(id: string): Promise<UserAccount | null> {
    const { items } = await this.queryAccounts({}, { page: 1, limit: 1 }, id);
    return items[0] ?? null;
  }

  listAccounts(
    filter: UserFilter,
    page: PageRequest,
  ): Promise<Paginated<UserAccount>> {
    return this.queryAccounts(filter, page);
  }

  countActiveInGroup(group: UserGroup): Promise<number> {
    return this.repository.count({ where: { group, active: true } });
  }

  async listActiveIds(group?: UserGroup): Promise<string[]> {
    const rows = await this.repository.find({
      where: { active: true, group },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  createWithCredential(
    user: NewUser,
    credential: NewCredential,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserOrmEntity);
      const saved = await users.save(users.create(user));
      await manager.getRepository(CredentialOrmEntity).insert({
        userId: saved.id,
        passwordHash: credential.passwordHash,
        mustChangePassword: credential.mustChangePassword,
      });
      return toUser(saved);
    });
  }

  async update(id: string, patch: UserPatch): Promise<User> {
    const changes: Partial<UserOrmEntity> = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (patch.active !== undefined) {
      changes.deactivatedAt = patch.active ? null : new Date();
    }
    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }
    return toUser(await this.repository.findOneOrFail({ where: { id } }));
  }

  async touchLastLogin(id: string, at: Date): Promise<void> {
    await this.repository.update({ id }, { lastLoginAt: at });
  }

  private async queryAccounts(
    filter: UserFilter,
    page: PageRequest,
    id?: string,
  ): Promise<Paginated<UserAccount>> {
    const query = this.repository
      .createQueryBuilder("user")
      .leftJoin(
        CredentialOrmEntity,
        "credential",
        "credential.idtb_users = user.idtb_users",
      )
      .addSelect(
        "credential.must_change_password",
        "credential_must_change_password",
      )
      .addSelect("credential.locked_until", "credential_locked_until")
      .orderBy("user.active", "DESC")
      .addOrderBy("user.name", "ASC")
      .skip((page.page - 1) * page.limit)
      .take(page.limit);

    if (id) query.andWhere("user.idtb_users = :id", { id });
    if (filter.group) query.andWhere("user.group = :group", filter);
    if (filter.active !== undefined) {
      query.andWhere("user.active = :active", filter);
    }
    const search = filter.search?.trim();
    if (search) {
      const term = `%${escapeLike(search)}%`;
      query.andWhere(
        new Brackets((where) =>
          where
            .where("user.name ILIKE :term", { term })
            .orWhere("user.username ILIKE :term", { term })
            .orWhere("user.email ILIKE :term", { term }),
        ),
      );
    }

    const [{ entities, raw }, total] = await Promise.all([
      query.getRawAndEntities<AccountRaw>(),
      query.getCount(),
    ]);
    const items = entities.map((row, index) => ({
      ...toUser(row),
      mustChangePassword: raw[index]?.credential_must_change_password ?? false,
      lockedUntil: raw[index]?.credential_locked_until ?? null,
    }));
    return paginate(items, total, page);
  }
}
