import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { Menu, MenuItem } from '@shared/ui/menu/menu';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { BoardFormDialog } from '../../components/board-form-dialog/board-form-dialog';
import { BoardsStore } from '../../data-access/boards.store';
import { Board, BoardInput } from '../../models/board';

const MENU: MenuItem[] = [
  { id: 'edit', label: 'Editar', icon: 'edit' },
  { id: 'remove', label: 'Eliminar', icon: 'trash', tone: 'danger', separated: true },
];

/** Lista de tableros (`/kanban`): se elige uno para abrirlo, o se crea uno nuevo. */
@Component({
  selector: 'app-board-list-page',
  imports: [
    RouterLink,
    TimeAgoPipe,
    PageHeader,
    Button,
    Card,
    Icon,
    Menu,
    Alert,
    EmptyState,
    Skeleton,
    BoardFormDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-list-page.html',
  styleUrl: './board-list-page.scss',
})
export class BoardListPage {
  protected readonly store = inject(BoardsStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly menu = MENU;
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Board | null>(null);

  /** Crea o edita según haya un tablero en edición. */
  protected readonly save = async (value: BoardInput): Promise<void> => {
    const editing = this.editing();
    if (editing) await this.store.update(editing.id, value);
    else await this.store.create(value);
  };

  constructor() {
    void this.store.load();
    void this.store.loadCounts();
  }

  protected reload(): void {
    void this.store.load(true);
    void this.store.loadCounts();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected taskCount(board: Board): number {
    return this.store.counts().get(board.id) ?? 0;
  }

  protected async onMenu(board: Board, action: string): Promise<void> {
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
      if (confirmed) await this.store.remove(board.id);
    }
  }
}
