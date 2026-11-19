import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
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

/**
 * Los proyectos en una tabla: cada repositorio, su rama, las etiquetas que apuntan a él y si tiene reglas o verificación. La receta y de qué depende se editan en la página de cada proyecto. Crear y editar son páginas aparte
 * (`/projects/new`, `/projects/:id/edit`). Los agentes de las ejecuciones reciben lo que escribes aquí en su prompt.
 */
@Component({
  selector: 'app-projects-page',
  imports: [
    RouterLink,
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
