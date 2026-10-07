import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import {
  PROVIDER_CATALOG_PORT,
  type ProviderCatalogPort,
} from '@ai-agents/domain/ports/provider-catalog.port';
import { AgentProvider, ProviderInfo } from '@ai-agents/domain/providers';

@Injectable()
export class AgentProvidersService {
  constructor(
    @Inject(PROVIDER_CATALOG_PORT)
    private readonly catalog: ProviderCatalogPort,
  ) {}

  list(): ProviderInfo[] {
    return this.catalog.list();
  }

  /** Un agente solo puede crearse, editarse o correr con un proveedor habilitado. */
  assertEnabled(provider: AgentProvider): void {
    const info = this.catalog.list().find((item) => item.id === provider);
    if (!info?.enabled) {
      throw new DomainError(
        `The provider "${provider}" is disabled. Enable it with AGENT_PROVIDERS`,
      );
    }
  }
}
