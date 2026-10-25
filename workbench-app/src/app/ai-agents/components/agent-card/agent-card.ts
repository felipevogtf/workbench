import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Avatar } from '@shared/ui/avatar/avatar';
import { ProvidersStore } from '../../data-access/providers.store';
import { Agent, agentLabel, levelLabel } from '../../models/agent';

@Component({
  selector: 'app-agent-card',
  imports: [RouterLink, Avatar, Card, Badge, Button, IconButton, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-card.html',
  styleUrl: './agent-card.scss',
})
export class AgentCard {
  readonly agent = input.required<Agent>();

  private readonly providers = inject(ProvidersStore);
  protected readonly providerLabel = computed(
    () =>
      this.providers.providers().find((p) => p.id === this.agent().provider)?.label ??
      this.agent().provider,
  );

  /** Con nombre para mostrar se ve ese (y el técnico debajo); si no, solo el técnico. */
  protected readonly label = computed(() => agentLabel(this.agent()));

  /** Para qué tickets sirve (solo desarrolladores con nivel). */
  protected readonly level = computed(() => levelLabel(this.agent().level));

  readonly setDefault = output<Agent>();
  readonly remove = output<Agent>();
}
