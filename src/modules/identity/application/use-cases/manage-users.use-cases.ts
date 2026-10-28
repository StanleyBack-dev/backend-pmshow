import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import type { Permission } from "@/modules/access-control/domain/permission";
import {
  canAssignGroup,
  checkManagement,
  type PermissionMatrix,
} from "@/modules/access-control/domain/permission-policy";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { PasswordService } from "@/modules/identity/application/password.service";
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepositoryPort,
} from "@/modules/identity/application/ports/credential-repository.port";
import {
  IDENTITY_NOTIFIER,
  type IdentityNotifierPort,
} from "@/modules/identity/application/ports/identity-notifier.port";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import {
  USER_REPOSITORY,
  type UserAccount,
  type UserFilter,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import { UNLOCKED } from "@/modules/identity/domain/lockout-policy";
import type { User } from "@/modules/identity/domain/user";
import {
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from "@/modules/identity/domain/username";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type CreateUserInput = {
  name: string;
  email: string;
  username: string;
  group: UserGroup;
};

export type UpdateUserInput = Partial<CreateUserInput>;

/** A password shown once to the admin, also sent by e-mail when possible. */
export type TemporaryAccess = {
  user: UserAccount;
  temporaryPassword: string;
  emailSent: boolean;
};

// Shared checks for every operation an admin performs on another user.
@Injectable()
export class UserManagementPolicy {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  async loadManageable(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<UserAccount> {
    const target = await this.users.findAccount(userId);
    if (!target) {
      throw AppException.from(APP_ERRORS.identity.userNotFound, undefined);
    }
    const denial = checkManagement(actor, target);
    if (denial === "self") {
      throw AppException.from(
        APP_ERRORS.accessControl.cannotManageSelf,
        undefined,
      );
    }
    if (denial === "insufficient-rank") {
      throw AppException.from(
        APP_ERRORS.accessControl.insufficientRank,
        undefined,
      );
    }
    return target;
  }

  assertCanAssign(actor: AuthenticatedUser, group: UserGroup): void {
    if (!canAssignGroup(actor.group, group)) {
      throw AppException.from(
        APP_ERRORS.accessControl.cannotAssignGroup,
        undefined,
      );
    }
  }

  /** Blocks removing (demoting or deactivating) the last active master. */
  async assertKeepsAMaster(
    target: User,
    next: { group: UserGroup; active: boolean },
  ): Promise<void> {
    const losesMaster =
      target.group === UserGroup.ADMIN_MASTER &&
      target.active &&
      (next.group !== UserGroup.ADMIN_MASTER || !next.active);
    if (
      losesMaster &&
      (await this.users.countActiveInGroup(UserGroup.ADMIN_MASTER)) <= 1
    ) {
      throw AppException.from(APP_ERRORS.identity.lastAdminMaster, undefined);
    }
  }

  async assertUniqueIdentity(
    input: { username?: string; email?: string },
    exceptUserId?: string,
  ): Promise<void> {
    if (input.username !== undefined) {
      if (!isValidUsername(input.username)) {
        throw AppException.from(APP_ERRORS.identity.usernameInvalid, undefined);
      }
      const owner = await this.users.findByUsername(input.username);
      if (owner && owner.id !== exceptUserId) {
        throw AppException.from(APP_ERRORS.identity.usernameTaken, undefined);
      }
    }
    if (input.email !== undefined) {
      const owner = await this.users.findByEmail(input.email);
      if (owner && owner.id !== exceptUserId) {
        throw AppException.from(APP_ERRORS.identity.emailTaken, undefined);
      }
    }
  }
}

@Injectable()
export class UserDirectoryUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  list(filter: UserFilter, page: PageRequest): Promise<Paginated<UserAccount>> {
    return this.users.listAccounts(filter, page);
  }

  async get(id: string): Promise<UserAccount> {
    const user = await this.users.findAccount(id);
    if (!user) {
      throw AppException.from(APP_ERRORS.identity.userNotFound, undefined);
    }
    return user;
  }
}

@Injectable()
export class ManageUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepositoryPort,
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(IDENTITY_NOTIFIER) private readonly notifier: IdentityNotifierPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly policy: UserManagementPolicy,
    private readonly passwords: PasswordService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditTrailService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateUserInput,
  ): Promise<TemporaryAccess> {
    this.policy.assertCanAssign(actor, input.group);
    const username = normalizeUsername(input.username);
    const email = normalizeEmail(input.email);
    await this.policy.assertUniqueIdentity({ username, email });

    const { temporary, hash } = await this.passwords.hashTemporary();
    const created = await this.users.createWithCredential(
      { name: input.name.trim(), email, username, group: input.group },
      { passwordHash: hash, mustChangePassword: true },
    );
    const emailSent = await this.notifier.accessCreated(created, temporary);

    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: created.id,
      created: true,
    });
    return {
      user: await this.reload(created.id),
      temporaryPassword: temporary,
      emailSent,
    };
  }

  async update(
    actor: AuthenticatedUser,
    userId: string,
    input: UpdateUserInput,
  ): Promise<UserAccount> {
    const target = await this.policy.loadManageable(actor, userId);
    const patch = {
      name: input.name?.trim(),
      email:
        input.email !== undefined ? normalizeEmail(input.email) : undefined,
      username:
        input.username !== undefined
          ? normalizeUsername(input.username)
          : undefined,
      group: input.group,
    };

    const groupChanged =
      patch.group !== undefined && patch.group !== target.group;
    if (groupChanged) {
      this.policy.assertCanAssign(actor, patch.group as UserGroup);
      await this.policy.assertKeepsAMaster(target, {
        group: patch.group as UserGroup,
        active: target.active,
      });
    }
    await this.policy.assertUniqueIdentity(
      {
        username:
          patch.username !== target.username ? patch.username : undefined,
        email: patch.email !== target.email ? patch.email : undefined,
      },
      userId,
    );

    await this.users.update(userId, patch);
    if (groupChanged) await this.permissions.resetToGroupDefaults(userId);

    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return this.reload(userId);
  }

  async setActive(
    actor: AuthenticatedUser,
    userId: string,
    active: boolean,
  ): Promise<UserAccount> {
    const target = await this.policy.loadManageable(actor, userId);
    if (target.active === active) return target;
    await this.policy.assertKeepsAMaster(target, {
      group: target.group,
      active,
    });

    await this.users.update(userId, { active });
    if (!active) {
      await this.sessions.revokeAllForUser(userId, this.clock.now());
    }
    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return this.reload(userId);
  }

  async resetPassword(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<TemporaryAccess> {
    const target = await this.policy.loadManageable(actor, userId);
    const temporary = await this.passwords.issueTemporary(userId);
    const emailSent = await this.notifier.passwordResetByAdmin(
      target,
      temporary,
    );
    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return {
      user: await this.reload(userId),
      temporaryPassword: temporary,
      emailSent,
    };
  }

  async unlock(actor: AuthenticatedUser, userId: string): Promise<UserAccount> {
    await this.policy.loadManageable(actor, userId);
    await this.credentials.update(userId, UNLOCKED);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return this.reload(userId);
  }

  async revokeSessions(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<UserAccount> {
    await this.policy.loadManageable(actor, userId);
    await this.sessions.revokeAllForUser(userId, this.clock.now());
    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return this.reload(userId);
  }

  private async reload(userId: string): Promise<UserAccount> {
    const account = await this.users.findAccount(userId);
    if (!account) {
      throw AppException.from(APP_ERRORS.identity.userNotFound, undefined);
    }
    return account;
  }
}

@Injectable()
export class UserPermissionsUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly policy: UserManagementPolicy,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditTrailService,
  ) {}

  async get(userId: string): Promise<PermissionMatrix> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw AppException.from(APP_ERRORS.identity.userNotFound, undefined);
    }
    return this.permissions.matrixFor(user);
  }

  /** `desired = null` restores the group defaults. */
  async set(
    actor: AuthenticatedUser,
    userId: string,
    desired: Permission[] | null,
  ): Promise<PermissionMatrix> {
    const target = await this.policy.loadManageable(actor, userId);
    const after = await this.permissions.replace(target, desired);

    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return after;
  }
}
