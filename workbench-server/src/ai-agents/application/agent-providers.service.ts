import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import {
  PROVIDER_CATALOG_PORT,
  type ProviderCatalogPort,
} from '@ai-agents/domain/ports/provider-catalog.port';
import {
  PROVIDER_SETTINGS_REPOSITORY_PORT,
  type ProviderSettingsRepositoryPort,
} from '@ai-agents/domain/ports/provider-settings-repository.port';
import {
  AgentProvider,
  ProviderInfo,
  isAgentProvider,
} from '@ai-agents/domain/providers';

export interface ProviderStatus extends ProviderInfo {
  enabled: boolean;
}

@Injectable()
export class AgentProvidersService {
  constructor(
    @Inject(PROVIDER_CATALOG_PORT)
    private readonly catalog: ProviderCatalogPort,
    @Inject(PROVIDER_SETTINGS_REPOSITORY_PORT)
    private readonly settings: ProviderSettingsRepositoryPort,
  ) {}

  async list(): Promise<ProviderStatus[]> {
    const disabled = new Set(await this.settings.findDisabled());
    return this.catalog.list().map((provider) => ({
      ...provider,
      enabled: !disabled.has(provider.id),
    }));
  }

  async setEnabled(id: string, enabled: boolean): Promise<ProviderStatus[]> {
    if (!isAgentProvider(id)) {
      throw new NotFoundException(`Provider ${id} not found`);
    }

    if (!enabled) {
      const others = (await this.list()).filter(
        (provider) => provider.id !== id && provider.enabled,
      );
      if (others.length === 0) {
        throw new DomainError('At least one provider must stay enabled');
      }
    }

    await this.settings.setEnabled(id, enabled);
    return this.list();
  }

  /** Un agente solo puede crearse, editarse o correr con un proveedor habilitado. */
  async assertEnabled(provider: AgentProvider): Promise<void> {
    const disabled = await this.settings.findDisabled();
    if (disabled.includes(provider)) {
      throw new DomainError(
        `The provider "${provider}" is disabled. Enable it in the agent providers settings`,
      );
    }
  }
}
