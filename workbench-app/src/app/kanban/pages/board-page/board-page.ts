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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Select, SelectOption } from '@shared/ui/select/select';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { IssuesStore } from '@tasks/index';
import { AddIssuesDialog } from '../../components/add-issues-dialog/add-issues-dialog';
import { BoardColumn, ColumnMove } from '../../components/board-column/board-column';
import { BoardFormDialog } from '../../components/board-form-dialog/board-form-dialog';
import { BoardViewStore } from '../../data-access/board-view.store';
import { BoardsStore } from '../../data-access/boards.store';
import { Board, BoardInput } from '../../models/board';

const LAST_BOARD_KEY = 'workbench.kanban.last-board';

const BOARD_MENU: MenuItem[] = [
  { id: 'edit', label: 'Editar tablero', icon: 'edit' },
  { id: 'remove', label: 'Eliminar tablero', icon: 'trash', tone: 'danger', separated: true },
];

/** Kanban (`/kanban` y `/kanban/:boardId`): un tablero con una columna por estado. */
@Component({
  selector: 'app-board-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CdkDropListGroup,
    PageHeader,
    Button,
    Icon,
    Menu,
    Select,
    Alert,
    EmptyState,
    Skeleton,
    BoardColumn,
    BoardFormDialog,
    AddIssuesDialog,
  ],
  providers: [BoardViewStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-page.html',
  styleUrl: './board-page.scss',
})
export class BoardPage {
  /** Viene de la ruta (`withComponentInputBinding`); vacío en `/kanban`. */
  readonly boardId = input<string>();

  protected readonly boards = inject(BoardsStore);
  protected readonly view = inject(BoardViewStore);
  protected readonly issues = inject(IssuesStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly boardMenu = BOARD_MENU;
  protected readonly boardControl = new FormControl('', { nonNullable: true });

  protected readonly board = computed<Board | null>(
    () => this.boards.boards().find((board) => board.id === this.boardId()) ?? null,
  );
  protected readonly boardOptions = computed<SelectOption[]>(() =>
    this.boards.boards().map((board) => ({ value: board.id, label: board.name })),
  );
  protected readonly hasStates = computed(() =>
    this.view.columns().some((c) => c.stateId !== null),
  );

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Board | null>(null);
  protected readonly addOpen = signal(false);

  /** Crea o edita según haya un tablero en edición; al crear, abre el nuevo. */
  protected readonly save = async (value: BoardInput): Promise<void> => {
    const editing = this.editing();
    if (editing) {
      await this.boards.update(editing.id, value);
    } else {
      const created = await this.boards.create(value);
      await this.router.navigate(['/kanban', created.id]);
    }
  };

  constructor() {
    void this.boards.load();

    // Sin tablero en la URL, se abre el último que se usó (o el primero).
    effect(() => {
      if (this.boardId() || !this.boards.loaded()) return;
      const list = this.boards.boards();
      if (list.length === 0) return;
      const last = readLastBoard();
      const target = list.find((board) => board.id === last) ?? list[0];
      untracked(() => void this.router.navigate(['/kanban', target.id], { replaceUrl: true }));
    });

    effect(() => {
      const board = this.board();
      if (!board) return;
      untracked(() => {
        rememberBoard(board.id);
        this.boardControl.setValue(board.id, { emitEvent: false });
        void this.view.load(board.id);
      });
    });
  }

  protected openBoard(id: string): void {
    if (id) void this.router.navigate(['/kanban', id]);
  }

  protected reload(): void {
    void this.boards.load(true);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected async onBoardMenu(action: string): Promise<void> {
    const board = this.board();
    if (!board) return;

    if (action === 'edit') {
      this.editing.set(board);
      this.formOpen.set(true);
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

  protected addIssues(ids: string[]): void {
    void this.view.addIssues(ids);
  }
}

function readLastBoard(): string | null {
  try {
    return localStorage.getItem(LAST_BOARD_KEY);
  } catch {
    return null;
  }
}

function rememberBoard(id: string): void {
  try {
    localStorage.setItem(LAST_BOARD_KEY, id);
  } catch {
    // Sin almacenamiento (modo privado): no se recuerda el último tablero.
  }
}
