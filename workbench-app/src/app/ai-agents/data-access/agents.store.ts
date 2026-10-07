import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { ResourceStore } from '@shared/util/resource-store';
import { Agent, AgentInput, AgentModule } from '../models/agent';
import { AgentsApi } from './agents.api';

@Injectable({ providedIn: 'root' })
export class AgentsStore extends ResourceStore<Agent> {
  private readonly api = inject(AgentsApi);
  private readonly toast = inject(Toast);

  readonly agents = computed(() => this.items());

  protected fetchAll() {
    return this.api.list();
  }

  /** Los agentes de un módulo. */
  agentsOf(module: AgentModule): Agent[] {
    return this.items().filter((agent) => agent.module === module);
  }

  /** El agente por defecto de un módulo (hay uno por módulo). */
  defaultAgentOf(module: AgentModule): Agent | null {
    return this.agentsOf(module).find((agent) => agent.isDefault) ?? null;
  }

  async find(id: string): Promise<Agent> {
    return this.items().find((agent) => agent.id === id) ?? firstValueFrom(this.api.get(id));
  }

  /** Lanza el error al llamador: el formulario lo muestra junto a los campos. */
  async create(input: AgentInput): Promise<Agent> {
    const created = await firstValueFrom(this.api.create(input));
    this.add(created);
    return created;
  }

  async update(id: string, patch: Partial<AgentInput>): Promise<Agent> {
    const updated = await firstValueFrom(this.api.update(id, patch));
    this.replace(updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.remove(id));
      this.drop(id);
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
        list.map((agent) =>
          agent.module === updated.module
            ? { ...agent, isDefault: agent.id === updated.id }
            : agent,
        ),
      );
      this.toast.success(`«${updated.name}» es ahora el agente por defecto`);
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }
}
