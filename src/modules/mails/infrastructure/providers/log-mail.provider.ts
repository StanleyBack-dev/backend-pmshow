import { Injectable, Logger } from "@nestjs/common";
import type {
  MailProviderPort,
  SendMailCommand,
} from "@/modules/mails/application/ports/mail-provider.port";

// MAIL_DRIVER=log: used until the Brevo account exists (and in tests/dev).
// Logs who would receive what, never the body — it may carry a temporary
// password or a recovery code.
@Injectable()
export class LogMailProvider implements MailProviderPort {
  private readonly logger = new Logger(LogMailProvider.name);

  send(command: SendMailCommand): Promise<void> {
    this.logger.log(
      `[e-mail não enviado: MAIL_DRIVER=log] para=${command.to.email} assunto="${command.subject}" tags=${(command.tags ?? []).join(",")}`,
    );
    return Promise.resolve();
  }
}
