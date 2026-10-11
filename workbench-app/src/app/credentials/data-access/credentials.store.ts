import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { copyText } from '@shared/util/copy-text';
import { ResourceStore } from '@shared/util/resource-store';
import { CredentialGroup, CredentialItem, GroupInput, ItemInput } from '../models/credential';
import { CredentialsApi } from './credentials.api';

/** Un valor revelado vuelve a ocultarse solo pasado este tiempo. */
export const REVEAL_TIMEOUT_MS = 30_000;

/** Grupos de credenciales con sus campos, y los valores que se están mostrando en pantalla. */
@Injectable({ providedIn: 'root' })
export class CredentialsStore extends ResourceStore<CredentialGroup> {
  private readonly api = inject(CredentialsApi);
  private readonly toast = inject(Toast);

  private readonly revealedState = signal<ReadonlyMap<string, string>>(new Map());
  private readonly hideTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly groups = computed(() => this.items());
  /** Categorías en uso, para sugerirlas al escribir una nueva. */
  readonly categories = computed(() => [
    ...new Set(
      this.items()
        .map((group) => group.category)
        .filter((category): category is string => !!category),
    ),
  ]);
  /** Valores a la vista (id del campo → valor). */
  readonly revealed = this.revealedState.asReadonly();

  protected fetchAll() {
    return this.api.list();
  }

  /** Lanzan el error al llamador: el diálogo lo muestra junto a los campos. */
  async create(input: GroupInput): Promise<CredentialGroup> {
    const created = await firstValueFrom(this.api.create(input));
    this.add(created);
    return created;
  }

  async update(id: string, patch: Partial<Omit<GroupInput, 'items'>>): Promise<CredentialGroup> {
    const updated = await firstValueFrom(this.api.update(id, patch));
    this.replace(updated);
    return updated;
  }

  async addItem(groupId: string, input: ItemInput): Promise<CredentialGroup> {
    const updated = await firstValueFrom(this.api.addItem(groupId, input));
    this.replace(updated);
    return updated;
  }

  async updateItem(
    groupId: string,
    itemId: string,
    patch: Partial<ItemInput>,
  ): Promise<CredentialGroup> {
    const updated = await firstValueFrom(this.api.updateItem(groupId, itemId, patch));
    this.replace(updated);
    this.hide(itemId);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      const group = this.items().find((current) => current.id === id);
      await firstValueFrom(this.api.remove(id));
      group?.items.forEach((item) => this.hide(item.id));
      this.drop(id);
      this.toast.success('Grupo eliminado');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  async removeItem(groupId: string, itemId: string): Promise<boolean> {
    try {
      const updated = await firstValueFrom(this.api.removeItem(groupId, itemId));
      this.replace(updated);
      this.hide(itemId);
      this.toast.success('Campo eliminado');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  /** Muestra u oculta el valor de un campo sensible (lo pide al servidor al mostrarlo). */
  async toggleReveal(groupId: string, item: CredentialItem): Promise<void> {
    if (this.revealedState().has(item.id)) {
      this.hide(item.id);
      return;
    }
    try {
      const { value } = await firstValueFrom(this.api.reveal(groupId, item.id));
      this.revealedState.update((map) => new Map(map).set(item.id, value));
      this.hideTimers.set(
        item.id,
        setTimeout(() => this.hide(item.id), REVEAL_TIMEOUT_MS),
      );
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  /** Copia el valor de un campo al portapapeles, sin dejarlo a la vista si era sensible. */
  async copyValue(groupId: string, item: CredentialItem): Promise<void> {
    try {
      const value =
        item.value ??
        this.revealedState().get(item.id) ??
        (await firstValueFrom(this.api.reveal(groupId, item.id))).value;
      await copyText(value);
      this.toast.success('Copiado al portapapeles');
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  private hide(itemId: string): void {
    clearTimeout(this.hideTimers.get(itemId));
    this.hideTimers.delete(itemId);
    if (!this.revealedState().has(itemId)) return;
    this.revealedState.update((map) => {
      const next = new Map(map);
      next.delete(itemId);
      return next;
    });
  }
}
