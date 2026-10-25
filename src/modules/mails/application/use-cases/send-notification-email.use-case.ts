import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  MAIL_PROVIDER,
  type MailAttachment,
  type MailProviderPort,
} from "@/modules/mails/application/ports/mail-provider.port";
import {
  renderNotificationEmail,
  type NotificationEmailContent,
} from "@/modules/mails/application/templates/notifications/notification-email.template";

export type NotificationEmail = Omit<
  NotificationEmailContent,
  "ctaUrl" | "hasCalendar"
> & {
  to: { email: string; name: string };
  /** App path the button opens, e.g. /eventos/<id>. */
  link: string;
  tag: string;
  attachments?: MailAttachment[];
};

// Unlike the identity e-mails, a failure here throws: these are sent from
// the outbox, which retries later.
@Injectable()
export class SendNotificationEmailUseCase {
  private readonly frontendUrl: string;

  constructor(
    @Inject(MAIL_PROVIDER) private readonly mail: MailProviderPort,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>("FRONTEND_URL") ?? "").replace(
      /\/$/,
      "",
    );
  }

  async send(email: NotificationEmail): Promise<void> {
    const rendered = renderNotificationEmail({
      recipientName: email.recipientName,
      subject: email.subject,
      intro: email.intro,
      details: email.details,
      ctaLabel: email.ctaLabel,
      ctaUrl: `${this.frontendUrl}${email.link}`,
      hasCalendar: (email.attachments ?? []).some((file) =>
        file.name.endsWith(".ics"),
      ),
    });
    await this.mail.send({
      to: email.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [email.tag],
      attachments: email.attachments,
    });
  }
}
