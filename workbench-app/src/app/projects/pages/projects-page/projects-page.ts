import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { ProjectsStore } from '../../data-access/projects.store';
import { Project } from '../../models/project';

/** Cuántos caracteres de la receta se muestran en la lista. */
const EXCERPT_CHARS = 140;

/**
 * Los proyectos en una tabla: cada repositorio con su receta, de qué otros depende y sus reglas. Crear y editar son páginas aparte
 * (`/projects/new`, `/projects/:id/edit`). Los agentes de las ejecuciones reciben lo que escribes aquí en su prompt.
 */
@Component({
  selector: 'app-projects-page',
  imports: [
    RouterLink,
    TimeAgoPipe,
    Alert,
    Badge,
    Button,
    EmptyState,
    Icon,
    IconButton,
    PageHeader,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-page.html',
  styleUrl: './projects-page.scss',
})
export class ProjectsPage {
  protected readonly store = inject(ProjectsStore);
  private readonly confirm = inject(ConfirmDialog);

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  /** El comienzo de la receta, en una línea, para reconocerla en la lista; vacío si no hay receta. */
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
