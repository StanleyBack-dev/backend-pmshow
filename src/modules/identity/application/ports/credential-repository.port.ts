import type { Credential } from "@/modules/identity/domain/user";

export type CredentialPatch = Partial<Omit<Credential, "userId">>;

export interface CredentialRepositoryPort {
  findByUserId(userId: string): Promise<Credential | null>;
  update(userId: string, patch: CredentialPatch): Promise<void>;
}

export const CREDENTIAL_REPOSITORY = Symbol("CREDENTIAL_REPOSITORY");
