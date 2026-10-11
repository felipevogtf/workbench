import { CredentialGroup } from '@credentials/domain/entities/credential-group.entity';

export interface CredentialGroupRepositoryPort {
  findById(groupId: string): Promise<CredentialGroup | null>;
  findAll(): Promise<CredentialGroup[]>;
  /** Guarda el grupo y deja exactamente sus ítems actuales (los quitados se borran). */
  save(group: CredentialGroup): Promise<void>;
  delete(groupId: string): Promise<void>;
}

export const CREDENTIAL_GROUP_REPOSITORY_PORT = Symbol(
  'CredentialGroupRepositoryPort',
);
