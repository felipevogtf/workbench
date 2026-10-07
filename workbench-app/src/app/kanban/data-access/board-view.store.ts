import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { IssuesStore, LabelsStore, ProjectsStore, StatesStore } from '@tasks/index';
import { Column, applyMove, buildColumns, columnOf, positionAt } from '../domain/board-columns';
import { BoardCard } from '../models/board';
import { BoardsApi } from './boards.api';

/**
 * Estado del tablero abierto: sus tarjetas y las columnas que resultan de unirlas con las tareas y
 * los estados. Se provee en la página (uno por tablero abierto).
 */
@Injectable()
export class BoardViewStore {
  private readonly api = inject(BoardsApi);
  private readonly issues = inject(IssuesStore);
  private readonly states = inject(StatesStore);
  private readonly projects = inject(ProjectsStore);
  private readonly labels = inject(LabelsStore);
  private readonly toast = inject(Toast);

  private readonly cards = signal<BoardCard[]>([]);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private boardId: string | null = null;

  readonly loading = this.loadingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Tareas del tablero sin las cerradas (el historial no se muestra). */
  private readonly openIssues = computed(
    () => new Map([...this.issues.issueById()].filter(([, issue]) => issue.closedAt === null)),
  );
  readonly cardCount = computed(() =>
    this.columns().reduce((total, column) => total + column.issueIds.length, 0),
  );

  /** Tareas del tablero que están en un estado finalizado. */
  readonly finishedIds = computed(() =>
    this.columns()
      .filter((column) => column.isFinal)
      .flatMap((column) => column.issueIds),
  );

  readonly columns = computed<Column[]>(() =>
    buildColumns(this.cards(), this.openIssues(), this.states.states()),
  );

  /** Abre un tablero: pide sus tarjetas y asegura que tareas, estados, proyectos y etiquetas estén cargados. */
  async load(boardId: string): Promise<void> {
    this.boardId = boardId;
    this.loadedState.set(false);
    this.loadingState.set(true);
    this.errorState.set(null);
    this.cards.set([]);
    try {
      const [cards] = await Promise.all([
        firstValueFrom(this.api.cards(boardId)),
        this.issues.load(),
        this.states.load(),
        // Las tarjetas muestran el proyecto y las etiquetas de cada tarea.
        this.projects.load(),
        this.labels.load(),
      ]);
      // Si mientras tanto se abrió otro tablero, esta respuesta ya no corresponde.
      if (this.boardId !== boardId) return;
      this.cards.set(cards);
      this.loadedState.set(true);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  /**
   * Mueve una tarea a una columna y a un lugar de ella. Se refleja de inmediato y, si el servidor
   * lo rechaza, todo vuelve a como estaba.
   */
  async move(issueId: string, targetKey: string, index: number): Promise<void> {
    const boardId = this.boardId;
    const source = columnOf(this.columns(), issueId);
    const target = this.columns().find((column) => column.key === targetKey);
    if (!boardId || !source || !target) return;
    // Soltarla donde ya estaba no cambia nada.
    if (source.key === target.key && source.issueIds.indexOf(issueId) === index) return;

    const previousCards = this.cards();
    const previousStateId = source.stateId;

    const moved = applyMove(this.columns(), issueId, targetKey, index);
    const newOrder = moved.find((column) => column.key === targetKey)!.issueIds;
    this.cards.update((cards) =>
      cards.map((card) => {
        const position = newOrder.indexOf(card.issueId);
        return position < 0 ? card : { ...card, position: positionAt(position) };
      }),
    );
    this.issues.applyState(issueId, target.stateId);

    try {
      await firstValueFrom(this.api.move(boardId, issueId, { stateId: target.stateId, index }));
    } catch (error) {
      this.cards.set(previousCards);
      this.issues.applyState(issueId, previousStateId);
      this.toast.error(errorMessage(error));
    }
  }

  /** Agrega tareas al tablero (cada una queda en la columna de su estado). */
  async addIssues(issueIds: readonly string[]): Promise<void> {
    const boardId = this.boardId;
    if (!boardId) return;

    const results = await Promise.allSettled(
      issueIds.map((issueId) => firstValueFrom(this.api.addIssue(boardId, issueId))),
    );
    const added = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    this.cards.update((cards) => [...cards, ...added]);

    const failed = results.length - added.length;
    if (failed > 0) {
      const reason = results.find((result) => result.status === 'rejected')?.reason;
      this.toast.error(`No se pudieron agregar ${failed} tarea(s): ${errorMessage(reason)}`);
    }
    if (added.length > 0) {
      this.toast.success(
        added.length === 1 ? 'Tarea agregada' : `${added.length} tareas agregadas`,
      );
    }
  }

  async removeIssue(issueId: string): Promise<void> {
    const boardId = this.boardId;
    if (!boardId) return;
    try {
      await firstValueFrom(this.api.removeIssue(boardId, issueId));
      this.cards.update((cards) => cards.filter((card) => card.issueId !== issueId));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }
}
