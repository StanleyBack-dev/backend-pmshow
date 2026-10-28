import type { UserGroup } from "@/modules/access-control/domain/user-group";
import type { User } from "@/modules/identity/domain/user";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type NewUser = {
  name: string;
  email: string;
  username: string;
  group: UserGroup;
};

export type UserPatch = Partial<
  Pick<
    User,
    | "name"
    | "email"
    | "username"
    | "group"
    | "active"
    | "avatarKey"
    | "onboardingCompletedAt"
  >
>;

export type UserFilter = {
  /** Matches name, username or e-mail (case-insensitive). */
  search?: string;
  group?: UserGroup;
  active?: boolean;
};

/** A user plus its login state, as the admin area shows it. */
export type UserAccount = User & {
  mustChangePassword: boolean;
  lockedUntil: Date | null;
};

export type NewCredential = {
  passwordHash: string;
  mustChangePassword: boolean;
};

export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  /** By username, or by e-mail when `login` contains "@". */
  findByLogin(login: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAccount(id: string): Promise<UserAccount | null>;
  listAccounts(
    filter: UserFilter,
    page: PageRequest,
  ): Promise<Paginated<UserAccount>>;
  countActiveInGroup(group: UserGroup): Promise<number>;
  /** Profile photo keys of these users (only those with a photo). */
  avatarKeys(ids: readonly string[]): Promise<Map<string, string>>;
  /** Ids of every enabled account (only those of `group`, when given). */
  listActiveIds(group?: UserGroup): Promise<string[]>;
  /** User and credential in one transaction. */
  createWithCredential(user: NewUser, credential: NewCredential): Promise<User>;
  update(id: string, patch: UserPatch): Promise<User>;
  touchLastLogin(id: string, at: Date): Promise<void>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
