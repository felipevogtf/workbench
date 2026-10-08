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
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { Spinner } from '@shared/ui/spinner/spinner';
import { TextInput } from '@shared/ui/text-input/text-input';
import { IssuesStore } from '../../data-access/issues.store';
import { ProjectsStore } from '../../data-access/projects.store';
import { Issue, issueCode } from '../../models/issue';

/** Elige la tarea de Plane (una sola) que reemplaza a una tarea local: recibe sus horas y su estado. */
@Component({
  selector: 'app-transfer-issue-dialog',
  imports: [Dialog, Button, FormField, TextInput, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transfer-issue-dialog.html',
  styleUrl: './transfer-issue-dialog.scss',
})
export class TransferIssueDialog {
  readonly open = model(false);
  /** La tarea local que se transfiere. */
  readonly issue = input.required<Issue>();

  readonly confirmed = output<string>();

  private readonly issuesStore = inject(IssuesStore);
  private readonly projectsStore = inject(ProjectsStore);

  protected readonly search = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);

  /** Tareas de Plane abiertas que cumplen la búsqueda (se muestran las primeras 100). */
  protected readonly available = computed(() => {
    const search = this.search().trim().toLowerCase();
    const projects = this.projectsStore.projectById();
    return this.issuesStore
      .issues()
      .filter((issue) => !issue.isLocal && !issue.closedAt)
      .map((issue) => ({
        issue,
        code: `${projects.get(issue.projectId)?.name ?? '—'} · ${issueCode(issue, projects.get(issue.projectId)?.identifier)}`,
      }))
      .filter(
        ({ issue, code }) => !search || `${issue.name} ${code}`.toLowerCase().includes(search),
      )
      .slice(0, 100);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => void this.prepare());
    });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    const id = this.selectedId();
    if (!id) return;
    this.confirmed.emit(id);
    this.open.set(false);
  }

  private async prepare(): Promise<void> {
    this.search.set('');
    this.selectedId.set(null);
    this.loading.set(true);
    try {
      await Promise.all([this.issuesStore.load(), this.projectsStore.load()]);
    } finally {
      this.loading.set(false);
    }
  }
}
