import { EMAIL_BRAND } from "@/modules/mails/application/templates/layout/email-brand";
import {
  escapeHtml,
  renderStandardEmailLayout,
} from "@/modules/mails/application/templates/layout/standard-email-layout.template";

export type RenderedEmail = { subject: string; html: string; text: string };

type Recipient = { name: string; username: string };

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const secretBox = (value: string) =>
  `<div style="margin:18px 0;padding:14px 18px;background:${EMAIL_BRAND.accentSoft};border-radius:12px;font-family:Consolas,Menlo,monospace;font-size:20px;font-weight:700;letter-spacing:2px;color:${EMAIL_BRAND.text};text-align:center;">${escapeHtml(value)}</div>`;

function temporaryAccessEmail(
  recipient: Recipient,
  temporaryPassword: string,
  loginUrl: string,
  intro: string,
  subject: string,
): RenderedEmail {
  const html = renderStandardEmailLayout({
    title: subject,
    preheader: "Seu usuário e uma senha temporária para entrar no PM SHOW.",
    heading: subject,
    contentHtml: `
      <p>Olá, ${escapeHtml(firstName(recipient.name))}!</p>
      <p>${intro}</p>
      <p style="margin-bottom:4px;">Usuário: <strong>${escapeHtml(recipient.username)}</strong></p>
      <p style="margin:0;">Senha temporária:</p>
      ${secretBox(temporaryPassword)}
      <p>No primeiro acesso você vai criar uma senha só sua. A senha temporária deixa de funcionar depois disso.</p>`,
    ctaLabel: "Entrar no PM SHOW",
    ctaUrl: loginUrl,
    footerNote:
      "Não compartilhe esta senha. Se você não esperava este e-mail, avise um gestor da banda.",
  });
  const text = `${intro}\n\nUsuário: ${recipient.username}\nSenha temporária: ${temporaryPassword}\n\nEntre em ${loginUrl} e crie uma nova senha no primeiro acesso.`;
  return { subject, html, text };
}

export function renderAccessCreatedEmail(
  recipient: Recipient,
  temporaryPassword: string,
  loginUrl: string,
): RenderedEmail {
  return temporaryAccessEmail(
    recipient,
    temporaryPassword,
    loginUrl,
    "Seu acesso ao app da banda PM SHOW foi criado. Use os dados abaixo para entrar.",
    "Seu acesso ao PM SHOW",
  );
}

export function renderPasswordResetByAdminEmail(
  recipient: Recipient,
  temporaryPassword: string,
  loginUrl: string,
): RenderedEmail {
  return temporaryAccessEmail(
    recipient,
    temporaryPassword,
    loginUrl,
    "Um gestor redefiniu a sua senha do PM SHOW. As sessões abertas foram encerradas.",
    "Sua senha do PM SHOW foi redefinida",
  );
}

export function renderRecoveryCodeEmail(
  recipient: Recipient,
  code: string,
  ttlMinutes: number,
): RenderedEmail {
  // The code stays out of the subject: subjects end up in provider logs and
  // lock-screen previews.
  const subject = "Código para redefinir sua senha do PM SHOW";
  const html = renderStandardEmailLayout({
    title: subject,
    preheader: `Use o código ${code} para redefinir sua senha do PM SHOW.`,
    heading: "Redefinição de senha",
    contentHtml: `
      <p>Olá, ${escapeHtml(firstName(recipient.name))}!</p>
      <p>Recebemos um pedido para redefinir a senha do usuário <strong>${escapeHtml(recipient.username)}</strong>. Use este código:</p>
      ${secretBox(code)}
      <p>O código vale por ${ttlMinutes} minutos.</p>`,
    footerNote:
      "Se não foi você, ignore este e-mail: sua senha continua a mesma.",
  });
  const text = `Código para redefinir a senha do usuário ${recipient.username}: ${code}\nO código vale por ${ttlMinutes} minutos. Se não foi você, ignore este e-mail.`;
  return { subject, html, text };
}

export function renderPasswordChangedEmail(
  recipient: Recipient,
  supportHint: string,
): RenderedEmail {
  const subject = "Sua senha do PM SHOW foi alterada";
  const html = renderStandardEmailLayout({
    title: subject,
    preheader: "A senha da sua conta acabou de ser alterada.",
    heading: subject,
    contentHtml: `
      <p>Olá, ${escapeHtml(firstName(recipient.name))}!</p>
      <p>A senha do usuário <strong>${escapeHtml(recipient.username)}</strong> acabou de ser alterada, e as outras sessões abertas foram encerradas.</p>
      <p>${escapeHtml(supportHint)}</p>`,
  });
  const text = `A senha do usuário ${recipient.username} foi alterada. ${supportHint}`;
  return { subject, html, text };
}
