import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  MAIL_PROVIDER,
  type MailProviderPort,
} from "@/modules/mails/application/ports/mail-provider.port";
import {
  renderAccessCreatedEmail,
  renderPasswordChangedEmail,
  renderPasswordResetByAdminEmail,
  renderRecoveryCodeEmail,
  type RenderedEmail,
} from "@/modules/mails/application/templates/identity/identity-emails.template";

export type IdentityEmailRecipient = {
  name: string;
  email: string;
  username: string;
};

// Account e-mails. Each method reports whether the e-mail went out and never
// throws: the account change already happened, and the admin screen shows
// the temporary password when the e-mail could not be sent.
@Injectable()
export class SendIdentityEmailsUseCase {
  private readonly logger = new Logger(SendIdentityEmailsUseCase.name);
  private readonly loginUrl: string;

  constructor(
    @Inject(MAIL_PROVIDER) private readonly mail: MailProviderPort,
    config: ConfigService,
  ) {
    const frontend = (config.get<string>("FRONTEND_URL") ?? "").replace(
      /\/$/,
      "",
    );
    this.loginUrl = `${frontend}/entrar`;
  }

  accessCreated(to: IdentityEmailRecipient, temporaryPassword: string) {
    return this.send(
      to,
      renderAccessCreatedEmail(to, temporaryPassword, this.loginUrl),
      "identity-access-created",
    );
  }

  passwordResetByAdmin(to: IdentityEmailRecipient, temporaryPassword: string) {
    return this.send(
      to,
      renderPasswordResetByAdminEmail(to, temporaryPassword, this.loginUrl),
      "identity-password-reset",
    );
  }

  recoveryCode(to: IdentityEmailRecipient, code: string, ttlMinutes: number) {
    return this.send(
      to,
      renderRecoveryCodeEmail(to, code, ttlMinutes),
      "identity-recovery-code",
    );
  }

  passwordChanged(to: IdentityEmailRecipient) {
    return this.send(
      to,
      renderPasswordChangedEmail(
        to,
        "Se não foi você, avise imediatamente um gestor da banda.",
      ),
      "identity-password-changed",
    );
  }

  private async send(
    to: IdentityEmailRecipient,
    email: RenderedEmail,
    tag: string,
  ): Promise<boolean> {
    try {
      await this.mail.send({
        to: { email: to.email, name: to.name },
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [tag],
      });
      return true;
    } catch (error) {
      this.logger.warn(`E-mail ${tag} não enviado: ${String(error)}`);
      return false;
    }
  }
}
