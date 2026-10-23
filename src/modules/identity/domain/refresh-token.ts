// A refresh token is "<sessionId>.<secret>". The session id locates the row;
// only a digest of the secret is stored. The secret does not rotate: the BFF
// may refresh from parallel requests, and rotation would turn that race into
// false "token reuse" logouts. Sessions are revocable instead (logout,
// password change, deactivation) and slide their expiry on each use.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function composeRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(
  token: string,
): { sessionId: string; secret: string } | null {
  const separator = token.indexOf(".");
  if (separator <= 0) return null;
  const sessionId = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  if (!UUID.test(sessionId) || secret.length < 32) return null;
  return { sessionId, secret };
}
