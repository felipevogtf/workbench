import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { ProjectDialog } from '../../components/project-dialog/project-dialog';
import { ProjectsStore } from '../../data-access/projects.store';
import { Project, ProjectInput } from '../../models/project';

/** Cuántos caracteres de la receta se muestran en la lista. */
const EXCERPT_CHARS = 200;

/**
 * Los proyectos: cada repositorio con su receta (cómo se levanta y se prueba), de qué otros repositorios depende
 * y sus reglas. Los agentes de las ejecuciones lo reciben en su prompt.
 */
@Component({
  selector: 'app-projects-page',
  imports: [
    TimeAgoPipe,
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    Icon,
    IconButton,
    PageHeader,
    Skeleton,
    ProjectDialog,
  ],
  providers: [ProjectsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-page.html',
  styleUrl: './projects-page.scss',
})
export class ProjectsPage {
  protected readonly store = inject(ProjectsStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly dialogOpen = signal(false);
  /** El proyecto que se edita; `null` = uno nuevo. */
  protected readonly editing = signal<Project | null>(null);

  protected readonly save = (input: ProjectInput, existing: Project | null): Promise<unknown> =>
    this.store.save(input, existing);

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected openNew(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(project: Project): void {
    this.editing.set(project);
    this.dialogOpen.set(true);
  }

  /** El comienzo de la receta, en una línea, para reconocerla en la lista. */
  protected excerpt(project: Project): string {
    const text = project.content
      .replace(/^[\s#>*-]+/gm, '')
      .replace(/[*`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS).trimEnd()}…` : text;
  }

  protected async remove(project: Project): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Borrar el proyecto',
      message: `El proyecto «${project.repo}» se borra y los agentes dejan de recibir su receta. Los demás proyectos que dependan de este repositorio seguirán nombrándolo.`,
      confirmLabel: 'Borrar',
      tone: 'danger',
    });
    if (confirmed) await this.store.remove(project);
  }
}
