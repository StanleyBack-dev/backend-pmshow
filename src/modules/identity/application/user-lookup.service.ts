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
