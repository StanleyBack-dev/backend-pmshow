export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol("PASSWORD_HASHER");
