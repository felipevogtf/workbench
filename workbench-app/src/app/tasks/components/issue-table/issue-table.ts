import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatHours } from '@shared/util/date';
import { Badge } from '@shared/ui/badge/badge';
import { Card } from '@shared/ui/card/card';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { Tag } from '@shared/ui/tag/tag';
import { HourTotalsStore } from '../../data-access/hour-totals.store';
import { LabelsStore } from '../../data-access/labels.store';
import { ProjectsStore } from '../../data-access/projects.store';
import { StatesStore } from '../../data-access/states.store';
import { Issue, issueCode } from '../../models/issue';
import { PriorityBadge } from '../priority-badge/priority-badge';

/** Tabla desde 768px; lista de cards por debajo. */
@Component({
  selector: 'app-issue-table',
  imports: [RouterLink, Badge, Card, Menu, Tag, PriorityBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-table.html',
  styleUrl: './issue-table.scss',
})
export class IssueTable {
  readonly items = input.required<readonly Issue[]>();

  readonly edit = output<Issue>();
  readonly remove = output<Issue>();
  readonly toggleClosed = output<Issue>();
  readonly togglePaused = output<Issue>();

  private readonly projects = inject(ProjectsStore).projectById;
  private readonly states = inject(StatesStore).stateById;
  private readonly labels = inject(LabelsStore).labelById;
  private readonly hourTotals = inject(HourTotalsStore).totals;

  protected readonly formatHours = formatHours;

  /** Datos de cada fila ya resueltos (proyecto, estado y etiquetas por id). */
  protected readonly rows = computed(() =>
    this.items().map((issue) => ({
      issue,
      code: issueCode(issue, this.projects().get(issue.projectId)?.identifier),
      state: issue.stateId ? (this.states().get(issue.stateId) ?? null) : null,
      labels: issue.labelIds.flatMap((id) => this.labels().get(id) ?? []),
      /** Horas registradas; `null` si todavía no tiene. */
      worked: this.hourTotals()[issue.id] ?? null,
      menu: menuFor(issue),
    })),
  );

  protected onMenu(issue: Issue, action: string): void {
    if (action === 'edit') this.edit.emit(issue);
    if (action === 'remove') this.remove.emit(issue);
    if (action === 'toggle-closed') this.toggleClosed.emit(issue);
    if (action === 'toggle-paused') this.togglePaused.emit(issue);
  }
}

function menuFor(issue: Issue): MenuItem[] {
  const items: MenuItem[] = [
    { id: 'edit', label: 'Editar', icon: 'edit' },
    issue.closedAt
      ? { id: 'toggle-closed', label: 'Reabrir', icon: 'refresh' }
      : { id: 'toggle-closed', label: 'Cerrar', icon: 'check' },
  ];
  // Una cerrada ya está en el historial: pausarla no tiene sentido.
  if (!issue.closedAt) {
    items.push(
      issue.pausedAt
        ? { id: 'toggle-paused', label: 'Reanudar', icon: 'refresh' }
        : { id: 'toggle-paused', label: 'Pausar', icon: 'clock' },
    );
  }
  // Las de Plane no se borran aquí: volverían en el próximo sync.
  if (issue.isLocal) {
    items.push({ id: 'remove', label: 'Eliminar', icon: 'trash', tone: 'danger', separated: true });
  }
  return items;
}
