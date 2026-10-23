// Usernames are case-insensitive and stored lowercase, e.g. "sgt.silva".
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value) && !/[._-]{2}/.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Login accepts either the username or the e-mail. */
export function isEmailLogin(login: string): boolean {
  return login.includes("@");
}
