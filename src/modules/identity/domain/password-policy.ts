export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordViolation =
  | "too-short"
  | "too-long"
  | "missing-letter"
  | "missing-digit"
  | "contains-username";

/** Every rule the password breaks (empty when it is acceptable). */
export function checkPassword(
  password: string,
  context: { username: string },
): PasswordViolation[] {
  const violations: PasswordViolation[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) violations.push("too-short");
  if (password.length > PASSWORD_MAX_LENGTH) violations.push("too-long");
  if (!/\p{L}/u.test(password)) violations.push("missing-letter");
  if (!/\d/.test(password)) violations.push("missing-digit");
  if (
    context.username.length >= 3 &&
    password.toLowerCase().includes(context.username.toLowerCase())
  ) {
    violations.push("contains-username");
  }
  return violations;
}
