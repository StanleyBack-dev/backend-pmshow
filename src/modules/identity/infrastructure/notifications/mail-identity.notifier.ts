import { Injectable } from "@nestjs/common";
import type { IdentityNotifierPort } from "@/modules/identity/application/ports/identity-notifier.port";
import type { User } from "@/modules/identity/domain/user";
import { SendIdentityEmailsUseCase } from "@/modules/mails/application/use-cases/send-identity-emails.use-case";

// Adapter: identity's notifications go out as e-mails through the mails
// module.
@Injectable()
export class MailIdentityNotifier implements IdentityNotifierPort {
  constructor(private readonly emails: SendIdentityEmailsUseCase) {}

  accessCreated(user: User, temporaryPassword: string): Promise<boolean> {
    return this.emails.accessCreated(user, temporaryPassword);
  }

  passwordResetByAdmin(
    user: User,
    temporaryPassword: string,
  ): Promise<boolean> {
    return this.emails.passwordResetByAdmin(user, temporaryPassword);
  }

  recoveryCode(user: User, code: string, ttlMinutes: number): Promise<boolean> {
    return this.emails.recoveryCode(user, code, ttlMinutes);
  }

  passwordChanged(user: User): Promise<boolean> {
    return this.emails.passwordChanged(user);
  }
}
