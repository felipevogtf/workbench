import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatDay, formatHours } from '@shared/util/date';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { Tag } from '@shared/ui/tag/tag';
import { Issue, LabelsStore, PriorityBadge, ProjectsStore, issueCode } from '@tasks/index';
import { Column } from '../../domain/board-columns';

const MAX_LABELS = 2;
const REMOVE = '__remove__';

/** Tarjeta de una tarea en el tablero. El menú ofrece «Mover a…» (la alternativa a arrastrar). */
@Component({
  selector: 'app-board-card',
  imports: [RouterLink, Menu, Tag, PriorityBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-card.html',
  styleUrl: './board-card.scss',
})
export class BoardCardItem {
  readonly issue = input.required<Issue>();
  /** Columnas a las que se puede mover (todas menos la actual). */
  readonly targets = input.required<readonly Column[]>();

  readonly moveTo = output<string>();
  readonly remove = output<void>();

  /** Ruta del tablero abierto: el detalle de la tarea la usa para su botón «volver». */
  protected readonly backTo = inject(Router).url.split(/[?#]/)[0];
  private readonly projects = inject(ProjectsStore).projectById;
  private readonly labelsById = inject(LabelsStore).labelById;

  protected readonly formatDay = formatDay;
  protected readonly formatHours = formatHours;

  protected readonly project = computed(
    () => this.projects().get(this.issue().projectId)?.name ?? '—',
  );
  protected readonly code = computed(() =>
    issueCode(this.issue(), this.projects().get(this.issue().projectId)?.identifier),
  );
  protected readonly labels = computed(() =>
    this.issue().labelIds.flatMap((id) => this.labelsById().get(id) ?? []),
  );
  protected readonly shownLabels = computed(() => this.labels().slice(0, MAX_LABELS));
  protected readonly hiddenLabels = computed(() => Math.max(0, this.labels().length - MAX_LABELS));

  protected readonly menu = computed<MenuItem[]>(() => [
    ...this.targets().map((column) => ({
      id: column.key,
      label: `Mover a ${column.name}`,
      icon: 'chevron-right' as const,
    })),
    { id: REMOVE, label: 'Quitar del tablero', icon: 'x', tone: 'danger', separated: true },
  ]);

  protected onMenu(id: string): void {
    if (id === REMOVE) this.remove.emit();
    else this.moveTo.emit(id);
  }
}
