export type AccessTokenClaims = { userId: string; sessionId: string };

export type VerifiedAccessToken =
  | { status: "valid"; claims: AccessTokenClaims }
  | { status: "expired" }
  | { status: "invalid" };

export interface AccessTokenPort {
  sign(claims: AccessTokenClaims): { token: string; expiresAt: Date };
  verify(token: string): VerifiedAccessToken;
}

export const ACCESS_TOKEN = Symbol("ACCESS_TOKEN");
