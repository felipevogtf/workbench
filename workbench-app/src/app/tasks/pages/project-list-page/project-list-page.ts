import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import {
  NamedItemDialog,
  NamedItemValue,
} from '../../components/named-item-dialog/named-item-dialog';
import { IssuesStore } from '../../data-access/issues.store';
import { ProjectsStore } from '../../data-access/projects.store';
import { Project } from '../../models/catalogs';

// Los proyectos de Plane solo se actualizan con el sync: no se editan ni se borran aquí.
const LOCAL_MENU: MenuItem[] = [
  { id: 'edit', label: 'Renombrar', icon: 'edit' },
  { id: 'remove', label: 'Eliminar', icon: 'trash', tone: 'danger', separated: true },
];

@Component({
  selector: 'app-project-list-page',
  imports: [
    TimeAgoPipe,
    PageHeader,
    Button,
    Icon,
    Menu,
    Badge,
    Alert,
    EmptyState,
    Skeleton,
    NamedItemDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-list-page.html',
  styleUrl: '../catalog-page.scss',
})
export class ProjectListPage {
  protected readonly store = inject(ProjectsStore);
  protected readonly issues = inject(IssuesStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly localMenu = LOCAL_MENU;
  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<Project | null>(null);

  protected readonly save = async (value: NamedItemValue): Promise<void> => {
    const editing = this.editing();
    if (editing) await this.store.rename(editing.id, value.name);
    else await this.store.create(value.name);
  };

  constructor() {
    void this.store.load();
    void this.issues.load();
  }

  protected reload(): void {
    void this.store.load(true);
  }

  protected sync(): void {
    void this.issues.sync();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected issueCount(project: Project): number {
    return this.issues.issues().filter((issue) => issue.projectId === project.id).length;
  }

  protected async onMenu(project: Project, action: string): Promise<void> {
    if (action === 'edit') {
      this.editing.set(project);
      this.dialogOpen.set(true);
    } else if (action === 'remove') {
      const confirmed = await this.confirm.ask({
        title: 'Eliminar proyecto',
        message: `¿Eliminar «${project.name}»? También se borran sus ${this.issueCount(project)} tareas y las horas registradas en ellas.`,
        confirmLabel: 'Eliminar',
        tone: 'danger',
      });
      if (confirmed) {
        await this.store.remove(project.id);
        await this.issues.load(true);
      }
    }
  }
}
