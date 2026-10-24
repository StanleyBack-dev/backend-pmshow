import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type {
  MailProviderPort,
  SendMailCommand,
} from "@/modules/mails/application/ports/mail-provider.port";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
const REQUEST_TIMEOUT_MS = 15_000;

// Talks to Brevo's transactional REST API directly — no SDK, nothing to
// bundle for the serverless function.
@Injectable()
export class BrevoMailProvider implements MailProviderPort {
  private readonly logger = new Logger(BrevoMailProvider.name);

  constructor(private readonly config: ConfigService) {
    if (
      this.config.get<string>("MAIL_DRIVER") === "brevo" &&
      !this.config.get<string>("BREVO_API_KEY")
    ) {
      this.logger.warn(
        "MAIL_DRIVER=brevo sem BREVO_API_KEY. O envio de e-mail falhará até que a variável seja definida.",
      );
    }
  }

  async send(command: SendMailCommand): Promise<void> {
    const apiKey = this.config.get<string>("BREVO_API_KEY");
    if (!apiKey) {
      throw AppException.from(APP_ERRORS.mails.notConfigured, undefined);
    }

    const response = await fetch(BREVO_SEND_URL, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: this.config.get<string>("MAIL_FROM_EMAIL"),
          name: this.config.get<string>("MAIL_FROM_NAME") ?? "PM SHOW",
        },
        to: [{ email: command.to.email, name: command.to.name }],
        subject: command.subject,
        htmlContent: command.html,
        textContent: command.text,
        replyTo: command.replyTo
          ? { email: command.replyTo.email, name: command.replyTo.name }
          : undefined,
        tags: command.tags,
        attachment: command.attachments?.map((file) => ({
          name: file.name,
          content: Buffer.from(file.content, "utf8").toString("base64"),
        })),
      }),
    });

    if (!response.ok) {
      throw AppException.from(APP_ERRORS.mails.providerFailure, {
        status: response.status,
      });
    }
  }
}
