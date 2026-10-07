import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { AgentProvider, ProviderStatus } from '../models/agent';
import { AgentsApi } from './agents.api';

/** Proveedores de IA (Claude, Copilot, Antigravity) y sus modelos. Cuáles están habilitados lo decide el servidor (AGENT_PROVIDERS). */
@Injectable({ providedIn: 'root' })
export class ProvidersStore {
  private readonly api = inject(AgentsApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<ProviderStatus[]>([]);
  private readonly loadedState = signal(false);
  private readonly loadingState = signal(false);

  readonly providers = this.items.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly enabled = computed(() => this.items().filter((provider) => provider.enabled));

  async load(force = false): Promise<void> {
    if (this.loadingState() || (this.loadedState() && !force)) return;

    this.loadingState.set(true);
    try {
      this.items.set(await firstValueFrom(this.api.providers()));
      this.loadedState.set(true);
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  modelsOf(id: AgentProvider | string | null | undefined): string[] {
    return this.items().find((provider) => provider.id === id)?.models ?? [];
  }
}
