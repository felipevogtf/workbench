import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { Tag } from '@shared/ui/tag/tag';
import { CredentialsStore } from '../../data-access/credentials.store';
import { CredentialGroup, CredentialItem } from '../../models/credential';

const GROUP_MENU: MenuItem[] = [
  { id: 'add', label: 'Agregar campo', icon: 'plus' },
  { id: 'edit', label: 'Editar grupo', icon: 'edit' },
  { id: 'remove', label: 'Eliminar grupo', icon: 'trash', tone: 'danger', separated: true },
];

const ITEM_MENU: MenuItem[] = [
  { id: 'edit', label: 'Editar', icon: 'edit' },
  { id: 'remove', label: 'Eliminar', icon: 'trash', tone: 'danger', separated: true },
];

const MASK = '••••••••';

/** Un grupo de credenciales con sus campos (clave → valor). Los sensibles se muestran ocultos. */
@Component({
  selector: 'app-credential-group-card',
  imports: [Card, Tag, Icon, IconButton, Button, Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './credential-group-card.html',
  styleUrl: './credential-group-card.scss',
})
export class CredentialGroupCard {
  protected readonly store = inject(CredentialsStore);

  readonly group = input.required<CredentialGroup>();
  readonly addItem = output();
  readonly editGroup = output();
  readonly removeGroup = output();
  readonly editItem = output<CredentialItem>();
  readonly removeItem = output<CredentialItem>();

  protected readonly groupMenu = GROUP_MENU;
  protected readonly itemMenu = ITEM_MENU;

  protected isRevealed(item: CredentialItem): boolean {
    return this.store.revealed().has(item.id);
  }

  /** Lo que se ve del valor: el real si no es sensible o está revelado; si no, puntos. */
  protected shown(item: CredentialItem): string {
    return item.value ?? this.store.revealed().get(item.id) ?? MASK;
  }

  protected isMasked(item: CredentialItem): boolean {
    return item.value === null && !this.isRevealed(item);
  }

  protected onGroupMenu(action: string): void {
    if (action === 'add') this.addItem.emit();
    else if (action === 'edit') this.editGroup.emit();
    else if (action === 'remove') this.removeGroup.emit();
  }

  protected onItemMenu(item: CredentialItem, action: string): void {
    if (action === 'edit') this.editItem.emit(item);
    else if (action === 'remove') this.removeItem.emit(item);
  }

  protected toggleReveal(item: CredentialItem): void {
    void this.store.toggleReveal(this.group().id, item);
  }

  protected copy(item: CredentialItem): void {
    void this.store.copyValue(this.group().id, item);
  }
}
