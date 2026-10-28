import { Inject, Injectable } from "@nestjs/common";
import type { UserGroup } from "@/modules/access-control/domain/user-group";
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";

/** What other modules may know about a user. */
export type UserSummary = {
  id: string;
  name: string;
  username: string;
  email: string;
  group: UserGroup;
  active: boolean;
};

// Identity's public read API for other modules (members, rosters…), so they
// never reach into identity's tables or repositories.
@Injectable()
export class UserLookupService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  /** Every enabled account (announcements to the whole band). */
  activeUserIds(): Promise<string[]> {
    return this.users.listActiveIds();
  }

  /** Enabled accounts of one group (e.g. who reviews new sign-ups). */
  activeUserIdsInGroup(group: UserGroup): Promise<string[]> {
    return this.users.listActiveIds(group);
  }

  /** Whether a login name or e-mail already belongs to an account. */
  async isTaken(input: {
    username?: string;
    email?: string;
  }): Promise<boolean> {
    const [byUsername, byEmail] = await Promise.all([
      input.username ? this.users.findByUsername(input.username) : null,
      input.email ? this.users.findByEmail(input.email) : null,
    ]);
    return Boolean(byUsername ?? byEmail);
  }

  /** Object storage key of the account's profile photo (null: none). */
  async avatarKeyOf(id: string): Promise<string | null> {
    return (await this.users.findById(id))?.avatarKey ?? null;
  }

  /** Profile photo of an account (key in the object storage). */
  async setAvatarKey(id: string, avatarKey: string | null): Promise<void> {
    await this.users.update(id, { avatarKey });
  }

  async findById(id: string): Promise<UserSummary | null> {
    const user = await this.users.findById(id);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      group: user.group,
      active: user.active,
    };
  }
}
