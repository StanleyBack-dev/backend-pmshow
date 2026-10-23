export interface MailAddress {
  email: string;
  name?: string;
}

export interface SendMailCommand {
  to: MailAddress;
  subject: string;
  html: string;
  text?: string;
  replyTo?: MailAddress;
  tags?: string[];
}

export interface MailProviderPort {
  send(command: SendMailCommand): Promise<void>;
}

export const MAIL_PROVIDER = Symbol("MAIL_PROVIDER");
