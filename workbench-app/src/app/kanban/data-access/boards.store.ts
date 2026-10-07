import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { ResourceStore } from '@shared/util/resource-store';
import { Board, BoardInput } from '../models/board';
import { BoardsApi } from './boards.api';

/** Lista de tableros. */
@Injectable({ providedIn: 'root' })
export class BoardsStore extends ResourceStore<Board> {
  private readonly api = inject(BoardsApi);
  private readonly toast = inject(Toast);

  private readonly countsState = signal<ReadonlyMap<string, number>>(new Map());

  readonly boards = computed(() => this.items());
  /** Tareas por tablero (id del tablero → cantidad). */
  readonly counts = this.countsState.asReadonly();

  protected fetchAll() {
    return this.api.list();
  }

  /** Cuenta las tareas de cada tablero (para la lista). Un fallo no impide ver los tableros. */
  async loadCounts(): Promise<void> {
    try {
      const cards = await firstValueFrom(this.api.assignments());
      const counts = new Map<string, number>();
      for (const card of cards) counts.set(card.boardId, (counts.get(card.boardId) ?? 0) + 1);
      this.countsState.set(counts);
    } catch {
      this.countsState.set(new Map());
    }
  }

  /** Lanzan el error al llamador: el diálogo lo muestra junto a los campos. */
  async create(input: BoardInput): Promise<Board> {
    const created = await firstValueFrom(this.api.create(input));
    this.add(created);
    return created;
  }

  async update(id: string, patch: Partial<BoardInput>): Promise<Board> {
    const updated = await firstValueFrom(this.api.update(id, patch));
    this.replace(updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.remove(id));
      this.drop(id);
      this.toast.success('Tablero eliminado');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }
}
