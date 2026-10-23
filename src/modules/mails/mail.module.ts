import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MAIL_PROVIDER } from "@/modules/mails/application/ports/mail-provider.port";
import { SendIdentityEmailsUseCase } from "@/modules/mails/application/use-cases/send-identity-emails.use-case";
import { BrevoMailProvider } from "@/modules/mails/infrastructure/providers/brevo-mail.provider";
import { LogMailProvider } from "@/modules/mails/infrastructure/providers/log-mail.provider";

@Module({
  providers: [
    BrevoMailProvider,
    LogMailProvider,
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService, BrevoMailProvider, LogMailProvider],
      useFactory: (
        config: ConfigService,
        brevo: BrevoMailProvider,
        log: LogMailProvider,
      ) => (config.get<string>("MAIL_DRIVER") === "brevo" ? brevo : log),
    },
    SendIdentityEmailsUseCase,
  ],
  exports: [SendIdentityEmailsUseCase],
})
export class MailModule {}
