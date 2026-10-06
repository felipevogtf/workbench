import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Agent } from '../../models/agent';

@Component({
  selector: 'app-agent-card',
  imports: [RouterLink, Card, Badge, Button, IconButton, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-card.html',
  styleUrl: './agent-card.scss',
})
export class AgentCard {
  readonly agent = input.required<Agent>();

  readonly setDefault = output<Agent>();
  readonly remove = output<Agent>();
}
