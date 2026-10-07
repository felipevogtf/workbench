import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { State, StateInput } from '../models/catalogs';
import { ResourceStore } from '@shared/util/resource-store';
import { TasksApi } from './tasks.api';

/** Estados de las tareas. Su orden (`position`) es el de las columnas del kanban. */
@Injectable({ providedIn: 'root' })
export class StatesStore extends ResourceStore<State> {
  private readonly api = inject(TasksApi);
  private readonly toast = inject(Toast);

  readonly states = computed(() => [...this.items()].sort((a, b) => a.position - b.position));
  readonly stateById = computed(() => new Map(this.items().map((state) => [state.id, state])));

  protected fetchAll() {
    return this.api.listStates();
  }

  /** Lanzan el error al llamador: el diálogo lo muestra junto a los campos. */
  async create(input: StateInput): Promise<State> {
    const created = await firstValueFrom(this.api.createState(input));
    this.add(created);
    return created;
  }

  async update(id: string, patch: Partial<StateInput>): Promise<State> {
    const updated = await firstValueFrom(this.api.updateState(id, patch));
    this.replace(updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deleteState(id));
      this.drop(id);
      this.toast.success('Estado eliminado');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  /** Sube (`-1`) o baja (`1`) un estado. Se aplica de inmediato y se revierte si el servidor falla. */
  async move(id: string, direction: -1 | 1): Promise<void> {
    const ids = reordered(
      this.states().map((state) => state.id),
      id,
      direction,
    );
    if (!ids) return;

    const previous = this.items();
    this.items.set(
      ids.map((stateId, position) => ({ ...this.stateById().get(stateId)!, position })),
    );
    try {
      this.items.set(await firstValueFrom(this.api.reorderStates(ids)));
    } catch (error) {
      this.items.set(previous);
      this.toast.error(errorMessage(error));
    }
  }
}

/** Devuelve `ids` con `id` movido una posición, o `null` si ya está en el borde. */
export function reordered(ids: readonly string[], id: string, direction: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return null;

  const result = [...ids];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}
