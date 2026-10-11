import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { TextInput } from '@shared/ui/text-input/text-input';
import { CredentialGroupCard } from '../../components/credential-group-card/credential-group-card';
import { GroupFormDialog } from '../../components/group-form-dialog/group-form-dialog';
import { ItemFormDialog, ItemFormValue } from '../../components/item-form-dialog/item-form-dialog';
import { CredentialsStore } from '../../data-access/credentials.store';
import { CredentialGroup, CredentialItem, GroupInput } from '../../models/credential';

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Grupos de credenciales (`/credentials`): se busca por nombre, categoría o clave, nunca por valor. */
@Component({
  selector: 'app-credential-list-page',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    Button,
    Icon,
    Alert,
    EmptyState,
    Skeleton,
    FormField,
    TextInput,
    CredentialGroupCard,
    GroupFormDialog,
    ItemFormDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './credential-list-page.html',
  styleUrl: './credential-list-page.scss',
})
export class CredentialListPage {
  protected readonly store = inject(CredentialsStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly searchForm = inject(NonNullableFormBuilder).group({ search: [''] });
  private readonly query = toSignal(this.searchForm.controls.search.valueChanges, {
    initialValue: '',
  });

  protected readonly groupDialogOpen = signal(false);
  protected readonly editingGroup = signal<CredentialGroup | null>(null);
  protected readonly itemDialogOpen = signal(false);
  /** El grupo al que se agrega un campo, o al que pertenece el que se edita. */
  protected readonly itemGroup = signal<CredentialGroup | null>(null);
  protected readonly editingItem = signal<CredentialItem | null>(null);

  protected readonly visible = computed(() => {
    const query = normalize(this.query().trim());
    const groups = this.store.groups();
    if (!query) return groups;
    return groups.filter((group) =>
      [group.name, group.category ?? '', ...group.items.map((item) => item.key)].some((text) =>
        normalize(text).includes(query),
      ),
    );
  });

  /** Crea o edita según haya un grupo en edición. */
  protected readonly saveGroup = async (value: GroupInput): Promise<void> => {
    const editing = this.editingGroup();
    if (editing)
      await this.store.update(editing.id, { name: value.name, category: value.category });
    else await this.store.create(value);
  };

  /** Agrega o edita según haya un campo en edición; sin valor nuevo se conserva el actual. */
  protected readonly saveItem = async ({ key, value, sensitive }: ItemFormValue): Promise<void> => {
    const group = this.itemGroup();
    if (!group) return;
    const editing = this.editingItem();
    if (editing) {
      await this.store.updateItem(group.id, editing.id, {
        key,
        sensitive,
        ...(value ? { value } : {}),
      });
    } else {
      await this.store.addItem(group.id, { key, value, sensitive });
    }
  };

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load(true);
  }

  protected openCreateGroup(): void {
    this.editingGroup.set(null);
    this.groupDialogOpen.set(true);
  }

  protected openEditGroup(group: CredentialGroup): void {
    this.editingGroup.set(group);
    this.groupDialogOpen.set(true);
  }

  protected openAddItem(group: CredentialGroup): void {
    this.itemGroup.set(group);
    this.editingItem.set(null);
    this.itemDialogOpen.set(true);
  }

  protected openEditItem(group: CredentialGroup, item: CredentialItem): void {
    this.itemGroup.set(group);
    this.editingItem.set(item);
    this.itemDialogOpen.set(true);
  }

  protected async removeGroup(group: CredentialGroup): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Eliminar grupo',
      message: `¿Eliminar «${group.name}» y sus ${group.items.length} campos? No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (confirmed) await this.store.remove(group.id);
  }

  protected async removeItem(group: CredentialGroup, item: CredentialItem): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Eliminar campo',
      message: `¿Eliminar «${item.key}» de «${group.name}»?`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (confirmed) await this.store.removeItem(group.id, item.id);
  }
}
