import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Dialog } from '@shared/ui/dialog/dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { Spinner } from '@shared/ui/spinner/spinner';
import { TextInput } from '@shared/ui/text-input/text-input';
import { IssuesStore, ProjectsStore, issueNumber } from '@tasks/index';
import { BoardsApi } from '../../data-access/boards.api';

/** Elige tareas que todavía no están en ningún tablero (una tarea solo puede estar en uno). */
@Component({
  selector: 'app-add-issues-dialog',
  imports: [Dialog, Button, Checkbox, FormField, TextInput, Alert, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-issues-dialog.html',
  styleUrl: './add-issues-dialog.scss',
})
export class AddIssuesDialog {
  readonly open = model(false);
  readonly boardName = input.required<string>();

  readonly confirmed = output<string[]>();

  private readonly api = inject(BoardsApi);
  private readonly issuesStore = inject(IssuesStore);
  private readonly projectsStore = inject(ProjectsStore);

  protected readonly search = signal('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly assigned = signal<ReadonlySet<string>>(new Set());
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Tareas libres que cumplen la búsqueda (se muestran las primeras 100). */
  protected readonly available = computed(() => {
    const search = this.search().trim().toLowerCase();
    const projects = this.projectsStore.projectById();
    return this.issuesStore
      .issues()
      .filter((issue) => !this.assigned().has(issue.id))
      .map((issue) => ({
        issue,
        label: `${projects.get(issue.projectId)?.name ?? '—'} #${issueNumber(issue)}`,
      }))
      .filter(
        ({ issue, label }) => !search || `${issue.name} ${label}`.toLowerCase().includes(search),
      )
      .slice(0, 100);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => void this.prepare());
    });
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected submit(): void {
    this.confirmed.emit([...this.selected()]);
    this.open.set(false);
  }

  private async prepare(): Promise<void> {
    this.search.set('');
    this.selected.set(new Set());
    this.error.set(null);
    this.loading.set(true);
    try {
      const [cards] = await Promise.all([
        firstValueFrom(this.api.assignments()),
        this.issuesStore.load(),
        this.projectsStore.load(),
      ]);
      this.assigned.set(new Set(cards.map((card) => card.issueId)));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
