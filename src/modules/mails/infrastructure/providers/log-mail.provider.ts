import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  MailProviderPort,
  SendMailCommand,
} from "@/modules/mails/application/ports/mail-provider.port";
import { maskEmail } from "@/common/logging/redact";

// MAIL_DRIVER=log: used until the Brevo account exists (and in tests/dev).
// Logs who would receive what. The body may carry a temporary password or a
// recovery code, so it is printed only in development — where it is the only
// way to finish those flows without a real mailbox.
@Injectable()
export class LogMailProvider implements MailProviderPort {
  private readonly logger = new Logger(LogMailProvider.name);
  private readonly showBody: boolean;

  constructor(config: ConfigService) {
    this.showBody = config.get<string>("NODE_ENV") === "development";
  }

  send(command: SendMailCommand): Promise<void> {
    this.logger.log(
      `[e-mail não enviado: MAIL_DRIVER=log] para=${maskEmail(command.to.email)} assunto="${command.subject}" tags=${(command.tags ?? []).join(",")} anexos=${(command.attachments ?? []).map((file) => file.name).join(",") || "-"}`,
    );
    if (this.showBody && command.text) {
      this.logger.log(`[corpo — só em development]\n${command.text}`);
    }
    return Promise.resolve();
  }
}
