export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailAttachment {
  name: string;
  /** Raw file content (UTF-8 text, e.g. an .ics calendar). */
  content: string;
  contentType: string;
}

export interface SendMailCommand {
  to: MailAddress;
  subject: string;
  html: string;
  text?: string;
  replyTo?: MailAddress;
  tags?: string[];
  attachments?: MailAttachment[];
}

export interface MailProviderPort {
  send(command: SendMailCommand): Promise<void>;
}

export const MAIL_PROVIDER = Symbol("MAIL_PROVIDER");
