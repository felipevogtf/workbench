import { Injectable, computed, inject } from '@angular/core';
import { Toast } from '@shared/ui/toast/toast';
import { ResourceStore } from '@shared/util/resource-store';
import { AgentProvider, ProviderStatus } from '../models/agent';
import { AgentsApi } from './agents.api';

/** Proveedores de IA (Claude, Copilot, Antigravity) y sus modelos. Cuáles están habilitados lo decide el servidor (AGENT_PROVIDERS). */
@Injectable({ providedIn: 'root' })
export class ProvidersStore extends ResourceStore<ProviderStatus> {
  private readonly api = inject(AgentsApi);
  private readonly toast = inject(Toast);

  readonly providers = computed(() => this.items());
  readonly enabled = computed(() => this.items().filter((provider) => provider.enabled));

  protected fetchAll() {
    return this.api.providers();
  }

  /** Un fallo no bloquea la pantalla: se avisa y los selectores quedan sin modelos. */
  override async load(force = false): Promise<void> {
    await super.load(force);
    const message = this.error();
    if (message) this.toast.error(message);
  }

  modelsOf(id: AgentProvider | string | null | undefined): string[] {
    return this.items().find((provider) => provider.id === id)?.models ?? [];
  }
}
