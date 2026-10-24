import { EMAIL_BRAND } from "@/modules/mails/application/templates/layout/email-brand";
import {
  escapeHtml,
  renderStandardEmailLayout,
} from "@/modules/mails/application/templates/layout/standard-email-layout.template";
import type { RenderedEmail } from "@/modules/mails/application/templates/identity/identity-emails.template";

export type NotificationEmailContent = {
  recipientName: string;
  subject: string;
  /** Plain-text paragraph right after the greeting. */
  intro: string;
  /** Label/value rows (Evento, Data, Local, Função…). */
  details: { label: string; value: string }[];
  ctaLabel: string;
  ctaUrl: string;
  /** Mentions the attached calendar file when there is one. */
  hasCalendar: boolean;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function detailsTable(details: NotificationEmailContent["details"]): string {
  if (details.length === 0) return "";
  const rows = details
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap;color:${EMAIL_BRAND.textSoft};font-size:13px;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;vertical-align:top;color:${EMAIL_BRAND.text};font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;padding:12px 16px;width:100%;background:${EMAIL_BRAND.cardBackground};border:1px solid ${EMAIL_BRAND.border};border-radius:12px;">${rows}</table>`;
}

// One layout for every in-app notification that also goes by e-mail
// (rosters, schedule changes, absences): greeting, a sentence, the facts.
export function renderNotificationEmail(
  content: NotificationEmailContent,
): RenderedEmail {
  const calendarHint = content.hasCalendar
    ? "<p>O arquivo <strong>evento.ics</strong> em anexo adiciona (ou atualiza) o compromisso na agenda do seu celular.</p>"
    : "";
  const html = renderStandardEmailLayout({
    title: content.subject,
    preheader: content.intro,
    heading: content.subject,
    contentHtml: `
      <p>Olá, ${escapeHtml(firstName(content.recipientName))}!</p>
      <p>${escapeHtml(content.intro)}</p>
      ${detailsTable(content.details)}
      ${calendarHint}`,
    ctaLabel: content.ctaLabel,
    ctaUrl: content.ctaUrl,
    footerNote:
      "Você pode escolher quais avisos recebe por e-mail na página Perfil do app.",
  });
  const text = [
    content.intro,
    "",
    ...content.details.map(({ label, value }) => `${label}: ${value}`),
    "",
    `${content.ctaLabel}: ${content.ctaUrl}`,
  ].join("\n");
  return { subject: content.subject, html, text };
}
