import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import {
  Agent,
  AgentLevel,
  agentLabel,
  effortLabel,
  levelLabel,
  moduleLabel,
} from '../../models/agent';

const LEVEL_TONE: Record<AgentLevel, BadgeTone> = {
  simple: 'neutral',
  medium: 'info',
  complex: 'warning',
};

/**
 * Los trabajadores en una tabla: quién es (avatar y nombre), a qué módulo sirve (los desarrolladores,
 * además, con el nivel de ticket que toman), con qué modelo y esfuerzo trabaja, y sus opciones. Lo demás
 * (prompt, herramientas, proveedor) vive en el detalle de cada uno. En pantallas chicas son tarjetas.
 */
@Component({
  selector: 'app-worker-table',
  imports: [RouterLink, Avatar, Badge, Button, Card, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './worker-table.html',
  styleUrl: './worker-table.scss',
})
export class WorkerTable {
  readonly agents = input.required<Agent[]>();

  readonly setDefault = output<Agent>();
  readonly remove = output<Agent>();

  protected readonly label = agentLabel;
  protected readonly module = moduleLabel;
  protected readonly effort = effortLabel;

  /** El chip del nivel de ticket, solo para los desarrolladores que lo tienen. */
  protected level(agent: Agent): { label: string; tone: BadgeTone } | null {
    const label = agent.module === 'task-developer' ? levelLabel(agent.level) : null;
    return label && agent.level ? { label, tone: LEVEL_TONE[agent.level] } : null;
  }
}
