import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { Board, BoardInput } from '../models/board';
import { BoardsApi } from './boards.api';

/** Lista de tableros. */
@Injectable({ providedIn: 'root' })
export class BoardsStore {
  private readonly api = inject(BoardsApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<Board[]>([]);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly countsState = signal<ReadonlyMap<string, number>>(new Map());

  readonly boards = this.items.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Tareas por tablero (id del tablero → cantidad). */
  readonly counts = this.countsState.asReadonly();

  /** Carga la lista; si ya está cargada no vuelve a pedirla salvo con `force`. */
  async load(force = false): Promise<void> {
    if (this.loadingState() || (this.loadedState() && !force)) return;

    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.list()));
      this.loadedState.set(true);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
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
    this.items.update((list) => [...list, created]);
    return created;
  }

  async update(id: string, patch: Partial<BoardInput>): Promise<Board> {
    const updated = await firstValueFrom(this.api.update(id, patch));
    this.items.update((list) => list.map((board) => (board.id === id ? updated : board)));
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.remove(id));
      this.items.update((list) => list.filter((board) => board.id !== id));
      this.toast.success('Tablero eliminado');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }
}
