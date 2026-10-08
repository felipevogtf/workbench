import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Toast } from '@shared/ui/toast/toast';
import { HourTotalsStore, Issue, IssueFormDialog, IssuesStore } from '@tasks/index';
import { AddIssuesDialog } from '../../components/add-issues-dialog/add-issues-dialog';
import { BoardColumn, ColumnMove } from '../../components/board-column/board-column';
import { BoardFormDialog } from '../../components/board-form-dialog/board-form-dialog';
import { BoardViewStore } from '../../data-access/board-view.store';
import { BoardsStore } from '../../data-access/boards.store';
import { Board, BoardInput } from '../../models/board';

const BOARD_MENU: MenuItem[] = [
  { id: 'edit', label: 'Editar tablero', icon: 'edit' },
  { id: 'close-finished', label: 'Cerrar tareas finalizadas', icon: 'check' },
  { id: 'remove', label: 'Eliminar tablero', icon: 'trash', tone: 'danger', separated: true },
];

/**
 * Un tablero (`/kanban/:boardId`): una columna por estado. Ocupa todo el ancho de la pantalla (el
 * shell lo muestra con barra superior y el menú como panel flotante).
 */
@Component({
  selector: 'app-board-page',
  imports: [
    RouterLink,
    CdkDropListGroup,
    Button,
    Icon,
    Menu,
    Alert,
    EmptyState,
    Skeleton,
    BoardColumn,
    BoardFormDialog,
    AddIssuesDialog,
    IssueFormDialog,
  ],
  providers: [BoardViewStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-page.html',
  styleUrl: './board-page.scss',
})
export class BoardPage {
  /** Viene de la ruta (`withComponentInputBinding`). */
  readonly boardId = input.required<string>();

  protected readonly boards = inject(BoardsStore);
  protected readonly view = inject(BoardViewStore);
  protected readonly issues = inject(IssuesStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmDialog);
  private readonly toast = inject(Toast);

  protected readonly boardMenu = BOARD_MENU;

  protected readonly board = computed<Board | null>(
    () => this.boards.boards().find((board) => board.id === this.boardId()) ?? null,
  );
  protected readonly hasStates = computed(() =>
    this.view.columns().some((c) => c.stateId !== null),
  );

  protected readonly formOpen = signal(false);
  protected readonly addOpen = signal(false);
  protected readonly newOpen = signal(false);

  protected readonly save = async (value: BoardInput): Promise<void> => {
    const board = this.board();
    if (board) await this.boards.update(board.id, value);
  };

  constructor() {
    void this.boards.load();
    // Las horas registradas cambian desde el detalle de cada tarea: se piden al abrir el tablero.
    void inject(HourTotalsStore).load();

    effect(() => {
      const board = this.board();
      if (!board) return;
      untracked(() => void this.view.load(board.id));
    });
  }

  protected reload(): void {
    void this.boards.load(true);
  }

  protected async onBoardMenu(action: string): Promise<void> {
    const board = this.board();
    if (!board) return;

    if (action === 'edit') {
      this.formOpen.set(true);
    } else if (action === 'close-finished') {
      await this.closeFinished();
    } else if (action === 'remove') {
      const confirmed = await this.confirm.ask({
        title: 'Eliminar tablero',
        message: `¿Eliminar «${board.name}»? Sus tareas no se borran: quedan libres para agregarlas a otro tablero.`,
        confirmLabel: 'Eliminar',
        tone: 'danger',
      });
      if (confirmed && (await this.boards.remove(board.id))) {
        await this.router.navigate(['/kanban']);
      }
    }
  }

  /** Pasa al historial las tareas del tablero que están en un estado finalizado. */
  private async closeFinished(): Promise<void> {
    const ids = this.view.finishedIds();
    if (ids.length === 0) {
      this.toast.info('No hay tareas finalizadas en este tablero');
      return;
    }
    const confirmed = await this.confirm.ask({
      title: 'Cerrar tareas finalizadas',
      message: `Se cerrarán ${ids.length} ${ids.length === 1 ? 'tarea finalizada' : 'tareas finalizadas'} de este tablero (pasan al historial y dejan de verse aquí).`,
      confirmLabel: 'Cerrar',
    });
    if (confirmed) await this.issues.close(ids);
  }

  protected onDrop(event: CdkDragDrop<string, string, string>): void {
    void this.view.move(event.item.data, event.container.data, event.currentIndex);
  }

  /** «Mover a…»: la tarea queda al final de la columna elegida. */
  protected onMoveTo({ issueId, targetKey }: ColumnMove): void {
    const target = this.view.columns().find((column) => column.key === targetKey);
    if (target) void this.view.move(issueId, targetKey, target.issueIds.length);
  }

  protected onRemove(issueId: string): void {
    void this.view.removeIssue(issueId);
  }

  /** La tarea recién creada se agrega sola al tablero (queda en la columna de su estado). */
  protected onCreated(issue: Issue): void {
    void this.view.addIssues([issue.id]);
  }

  protected addIssues(ids: string[]): void {
    void this.view.addIssues(ids);
  }
}
