import type { User } from "@/modules/identity/domain/user";

// What the identity module needs to tell a person. The adapter decides the
// channel (e-mail today).
export interface IdentityNotifierPort {
  accessCreated(user: User, temporaryPassword: string): Promise<boolean>;
  passwordResetByAdmin(user: User, temporaryPassword: string): Promise<boolean>;
  recoveryCode(user: User, code: string, ttlMinutes: number): Promise<boolean>;
  passwordChanged(user: User): Promise<boolean>;
}

export const IDENTITY_NOTIFIER = Symbol("IDENTITY_NOTIFIER");
