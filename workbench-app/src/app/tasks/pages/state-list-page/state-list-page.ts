import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import {
  NamedItemDialog,
  NamedItemValue,
} from '../../components/named-item-dialog/named-item-dialog';
import { StatesStore } from '../../data-access/states.store';
import { State } from '../../models/catalogs';

const MENU: MenuItem[] = [
  { id: 'edit', label: 'Editar', icon: 'edit' },
  { id: 'remove', label: 'Eliminar', icon: 'trash', tone: 'danger', separated: true },
];

@Component({
  selector: 'app-state-list-page',
  imports: [
    PageHeader,
    Badge,
    Button,
    Icon,
    IconButton,
    Menu,
    Alert,
    EmptyState,
    Skeleton,
    NamedItemDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './state-list-page.html',
  styleUrl: '../catalog-page.scss',
})
export class StateListPage {
  protected readonly store = inject(StatesStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly menu = MENU;
  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<State | null>(null);

  /** Función estable que el diálogo llama al guardar (crea o edita según corresponda). */
  protected readonly save = async (value: NamedItemValue): Promise<void> => {
    const editing = this.editing();
    if (editing) await this.store.update(editing.id, value);
    else await this.store.create(value);
  };

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load(true);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected move(state: State, direction: -1 | 1): void {
    void this.store.move(state.id, direction);
  }

  protected async onMenu(state: State, action: string): Promise<void> {
    if (action === 'edit') {
      this.editing.set(state);
      this.dialogOpen.set(true);
    } else if (action === 'remove') {
      const confirmed = await this.confirm.ask({
        title: 'Eliminar estado',
        message: `¿Eliminar «${state.name}»? Las tareas que lo tienen quedan sin estado.`,
        confirmLabel: 'Eliminar',
        tone: 'danger',
      });
      if (confirmed) await this.store.remove(state.id);
    }
  }
}
