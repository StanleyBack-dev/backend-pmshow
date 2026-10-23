import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
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
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import type { User } from "@/modules/identity/domain/user";
import { normalizeEmail } from "@/modules/identity/domain/username";

/** The signed-in user changing their own password (also the first access). */
@Injectable()
export class ChangeOwnPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepositoryPort,
    @Inject(IDENTITY_NOTIFIER) private readonly notifier: IdentityNotifierPort,
    private readonly passwords: PasswordService,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const credential = await this.credentials.findByUserId(actor.id);
    const user = await this.users.findById(actor.id);
    if (!credential || !user) {
      throw AppException.from(APP_ERRORS.identity.userNotFound, undefined);
    }

    if (
      !(await this.passwords.matches(
        input.currentPassword,
        credential.passwordHash,
      ))
    ) {
      throw AppException.from(
        APP_ERRORS.identity.wrongCurrentPassword,
        undefined,
      );
    }
    if (input.newPassword === input.currentPassword) {
      throw AppException.from(APP_ERRORS.identity.samePassword, undefined);
    }
    this.passwords.assertAcceptable(input.newPassword, user.username);

    // Other devices are signed out; this one stays.
    await this.passwords.setChosen(
      actor.id,
      input.newPassword,
      actor.sessionId,
    );
    await this.notifier.passwordChanged(user);
    await this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action: credential.mustChangePassword
        ? "user.first_access_completed"
        : "user.password_changed",
      entity: "user",
      entityId: actor.id,
    });
  }
}

@Injectable()
export class UpdateOwnProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: { name: string; email: string },
  ): Promise<User> {
    const before = await this.users.findById(actor.id);
    if (!before) {
      throw AppException.from(APP_ERRORS.identity.userNotFound, undefined);
    }

    const email = normalizeEmail(input.email);
    if (email !== before.email) {
      const owner = await this.users.findByEmail(email);
      if (owner && owner.id !== actor.id) {
        throw AppException.from(APP_ERRORS.identity.emailTaken, undefined);
      }
    }

    const name = input.name.trim();
    const updated = await this.users.update(actor.id, { name, email });
    await this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action: "user.profile_updated",
      entity: "user",
      entityId: actor.id,
      before: { name: before.name, email: before.email },
      after: { name, email },
    });
    return updated;
  }
}
