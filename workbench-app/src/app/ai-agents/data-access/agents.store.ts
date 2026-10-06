import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { Agent, AgentInput } from '../models/agent';
import { AgentsApi } from './agents.api';

@Injectable({ providedIn: 'root' })
export class AgentsStore {
  private readonly api = inject(AgentsApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<Agent[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly loadedState = signal(false);

  readonly agents = this.items.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly defaultAgent = computed(() => this.items().find((agent) => agent.isDefault) ?? null);

  /** Carga la lista; si ya está cargada no vuelve a pedirla salvo con `force`. */
  async load(force = false): Promise<void> {
    if (this.loadingState() || (this.loadedState() && !force)) return;

    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.list()));
      this.loadedState.set(true);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  async find(id: string): Promise<Agent> {
    return this.items().find((agent) => agent.id === id) ?? firstValueFrom(this.api.get(id));
  }

  /** Lanza el error al llamador: el formulario lo muestra junto a los campos. */
  async create(input: AgentInput): Promise<Agent> {
    const created = await firstValueFrom(this.api.create(input));
    this.items.update((list) => [...list, created]);
    return created;
  }

  async update(id: string, patch: Partial<AgentInput>): Promise<Agent> {
    const updated = await firstValueFrom(this.api.update(id, patch));
    this.items.update((list) => list.map((agent) => (agent.id === id ? updated : agent)));
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.remove(id));
      this.items.update((list) => list.filter((agent) => agent.id !== id));
      this.toast.success('Agente eliminado');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  async setDefault(id: string): Promise<void> {
    try {
      const updated = await firstValueFrom(this.api.setDefault(id));
      this.items.update((list) =>
        list.map((agent) => ({ ...agent, isDefault: agent.id === updated.id })),
      );
      this.toast.success(`«${updated.name}» es ahora el agente por defecto`);
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }
}
