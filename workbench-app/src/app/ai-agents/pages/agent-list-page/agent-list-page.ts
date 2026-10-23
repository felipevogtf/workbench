import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { AgentCard } from '../../components/agent-card/agent-card';
import { AgentsStore } from '../../data-access/agents.store';
import { ProvidersStore } from '../../data-access/providers.store';
import { Agent, AgentScope, modulesOf } from '../../models/agent';

@Component({
  selector: 'app-agent-list-page',
  imports: [RouterLink, PageHeader, Button, Icon, Alert, EmptyState, Skeleton, AgentCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-list-page.html',
  styleUrl: './agent-list-page.scss',
})
export class AgentListPage {
  /** Viene de la ruta (`data.scope`): los agentes de siempre o los de los trabajadores. */
  readonly scope = input<AgentScope>('general');

  protected readonly store = inject(AgentsStore);
  protected readonly groups = computed(() => modulesOf(this.scope()));
  /** Los agentes de esta pantalla: los del otro menú no aparecen aquí. */
  protected readonly visible = computed(() => {
    const modules = this.groups().map((group) => group.value);
    return this.store.agents().filter((agent) => modules.includes(agent.module));
  });
  // Carga los proveedores para que las tarjetas muestren su nombre.
  private readonly providers = inject(ProvidersStore);
  private readonly confirm = inject(ConfirmDialog);

  constructor() {
    void this.store.load();
    void this.providers.load();
  }

  protected reload(): void {
    void this.store.load(true);
  }

  protected setDefault(agent: Agent): void {
    void this.store.setDefault(agent.id);
  }

  protected async remove(agent: Agent): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Eliminar agente',
      message: `¿Eliminar «${agent.name}»? Las revisiones ya hechas conservan su historial.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (confirmed) {
      await this.store.remove(agent.id);
    }
  }
}
