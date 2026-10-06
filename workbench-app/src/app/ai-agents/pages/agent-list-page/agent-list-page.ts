import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
import { Agent } from '../../models/agent';

@Component({
  selector: 'app-agent-list-page',
  imports: [RouterLink, PageHeader, Button, Icon, Alert, EmptyState, Skeleton, AgentCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-list-page.html',
  styleUrl: './agent-list-page.scss',
})
export class AgentListPage {
  protected readonly store = inject(AgentsStore);
  private readonly confirm = inject(ConfirmDialog);

  constructor() {
    void this.store.load();
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
