import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IssuesStore, ProjectsStore, issueCode } from '@tasks/index';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { MAX_GROUP_MEMBERS, OrganizerMember } from '../../models/organizer';

/** Cuántas coincidencias se ofrecen al buscar una tarea para sumar. */
const MAX_SUGGESTIONS = 8;

/**
 * Las tareas del grupo, en el orden en que se hacen (se mueven con las flechas), y un buscador para sumar otras. Cada cambio
 * se avisa con la lista completa y ordenada: quien lo guarda es la pantalla.
 */
@Component({
  selector: 'app-members-panel',
  imports: [Card, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './members-panel.html',
  styleUrl: './members-panel.scss',
})
export class MembersPanel {
  readonly members = input.required<readonly OrganizerMember[]>();
  /** La tarea del grupo: no se puede sumar a sí misma. */
  readonly groupIssueId = input.required<string>();
  readonly saving = input(false);

  /** Los ids de las tareas del grupo, en el orden nuevo. */
  readonly changed = output<string[]>();

  protected readonly maxMembers = MAX_GROUP_MEMBERS;
  protected readonly search = signal('');

  private readonly issues = inject(IssuesStore);
  private readonly projects = inject(ProjectsStore);

  /** Tareas abiertas que coinciden con lo buscado y todavía no son del grupo (por código, nombre o proyecto). */
  protected readonly suggestions = computed(() => {
    const text = this.search().trim().toLowerCase();
    if (text.length < 2) return [];
    const taken = new Set(this.members().map((member) => member.id));
    const projectById = this.projects.projectById();
    return this.issues
      .issues()
      .filter((issue) => issue.closedAt === null && !taken.has(issue.id))
      .filter((issue) => issue.id !== this.groupIssueId())
      .map((issue) => ({
        id: issue.id,
        name: issue.name,
        code: issueCode(issue, projectById.get(issue.projectId)?.identifier),
        project: projectById.get(issue.projectId)?.name ?? '',
      }))
      .filter((entry) =>
        `${entry.code} ${entry.name} ${entry.project}`.toLowerCase().includes(text),
      )
      .slice(0, MAX_SUGGESTIONS);
  });

  protected readonly full = computed(() => this.members().length >= MAX_GROUP_MEMBERS);

  constructor() {
    void this.issues.load();
    void this.projects.load();
  }

  protected add(id: string): void {
    if (this.full()) return;
    this.changed.emit([...this.members().map((member) => member.id), id]);
    this.search.set('');
  }

  protected remove(id: string): void {
    this.changed.emit(this.members().flatMap((member) => (member.id === id ? [] : [member.id])));
  }

  /** Cambia de lugar una tarea (`-1` la sube, `1` la baja). */
  protected move(index: number, step: -1 | 1): void {
    const ids = this.members().map((member) => member.id);
    const target = index + step;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.changed.emit(ids);
  }
}
