import { EMAIL_BRAND } from "./email-brand";

interface StandardEmailLayoutInput {
  title: string;
  preheader: string;
  heading: string;
  contentHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderStandardEmailLayout({
  title,
  preheader,
  heading,
  contentHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
}: StandardEmailLayoutInput): string {
  const year = new Date().getFullYear();
  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
      <div style="margin:28px 0 8px 0;text-align:center;">
        <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${EMAIL_BRAND.accent};color:${EMAIL_BRAND.white};text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px;">
          ${escapeHtml(ctaLabel)}
        </a>
      </div>`
      : "";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_BRAND.pageBackground};font-family:Inter,Segoe UI,Arial,sans-serif;color:${EMAIL_BRAND.text};">
    <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_BRAND.pageBackground};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:${EMAIL_BRAND.surface};border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;background:${EMAIL_BRAND.headerBackground};">
                <div style="font-size:15px;font-weight:800;letter-spacing:1px;color:${EMAIL_BRAND.headerText};">PM <span style="color:${EMAIL_BRAND.gold};">SHOW</span></div>
                <h1 style="margin:14px 0 0 0;font-size:21px;line-height:1.3;color:${EMAIL_BRAND.headerText};">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;">
                <div style="font-size:15px;line-height:1.6;color:${EMAIL_BRAND.textMuted};">${contentHtml}</div>
                ${ctaHtml}
                <p style="margin:24px 0 0 0;font-size:12px;line-height:1.5;color:${EMAIL_BRAND.textSoft};">
                  ${escapeHtml(footerNote || "Você recebeu este e-mail porque tem acesso ao app PM SHOW.")}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px;background:${EMAIL_BRAND.cardBackground};border-top:1px solid ${EMAIL_BRAND.border};font-size:11px;color:${EMAIL_BRAND.textSoft};text-align:center;">
                PM SHOW · Banda da Polícia Militar de Goiás © ${year}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}
