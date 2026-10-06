import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Alert } from '@shared/ui/alert/alert';
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
import { LabelsStore } from '../../data-access/labels.store';
import { Label } from '../../models/catalogs';

const MENU: MenuItem[] = [
  { id: 'edit', label: 'Editar', icon: 'edit' },
  { id: 'remove', label: 'Eliminar', icon: 'trash', tone: 'danger', separated: true },
];

@Component({
  selector: 'app-label-list-page',
  imports: [PageHeader, Button, Icon, Menu, Alert, EmptyState, Skeleton, NamedItemDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './label-list-page.html',
  styleUrl: '../catalog-page.scss',
})
export class LabelListPage {
  protected readonly store = inject(LabelsStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly menu = MENU;
  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<Label | null>(null);

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

  protected async onMenu(label: Label, action: string): Promise<void> {
    if (action === 'edit') {
      this.editing.set(label);
      this.dialogOpen.set(true);
    } else if (action === 'remove') {
      const confirmed = await this.confirm.ask({
        title: 'Eliminar etiqueta',
        message: `¿Eliminar «${label.name}»? Se quita de todas las tareas que la tienen.`,
        confirmLabel: 'Eliminar',
        tone: 'danger',
      });
      if (confirmed) await this.store.remove(label.id);
    }
  }
}
