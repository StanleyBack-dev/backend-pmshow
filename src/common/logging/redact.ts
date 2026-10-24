// Masks personal data and secrets before text reaches a log or an error
// column (LGPD): e-mail addresses, phone-like digit runs, bearer tokens and
// JWTs. Database errors, for instance, quote the offending value.

const EMAIL =
  /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER = /\b(Bearer|api-key[:=]?)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
/** 10+ digits, optionally split by spaces, dots, dashes or parentheses. */
const DIGITS = /(?<![\w-])\+?\(?\d[\d\s().-]{8,}\d(?![\w-])/g;

/** "silva@pm.go.gov.br" → "s***@pm.go.gov.br". */
export function maskEmail(email: string): string {
  return email.replace(EMAIL, "$1***@$2");
}

export function redact(text: string): string {
  return maskEmail(
    text
      .replace(JWT, "[jwt]")
      .replace(BEARER, "$1 [redacted]")
      .replace(DIGITS, (match) =>
        match.replace(/\D/g, "").length >= 10 ? "[número]" : match,
      ),
  );
}
