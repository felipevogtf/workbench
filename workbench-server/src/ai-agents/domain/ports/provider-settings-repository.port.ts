import { AgentProvider } from '@ai-agents/domain/providers';

/** Qué proveedores están habilitados. Un proveedor sin registro está habilitado. */
export interface ProviderSettingsRepositoryPort {
  findDisabled(): Promise<AgentProvider[]>;
  setEnabled(provider: AgentProvider, enabled: boolean): Promise<void>;
}

export const PROVIDER_SETTINGS_REPOSITORY_PORT = Symbol(
  'PROVIDER_SETTINGS_REPOSITORY_PORT',
);
