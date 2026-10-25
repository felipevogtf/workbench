import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Badge } from '@shared/ui/badge/badge';
import { Spinner } from '@shared/ui/spinner/spinner';
import { BoardCard, TicketStatus } from '../../models/execution';

const COLUMNS: readonly { status: TicketStatus; label: string }[] = [
  { status: 'pending', label: 'Pendiente' },
  { status: 'developing', label: 'Desarrollando' },
  { status: 'reviewing', label: 'En revisión' },
  { status: 'done', label: 'Hecho' },
  { status: 'failed', label: 'Falló' },
];

/**
 * Los tickets de una ejecución como un tablero: una columna por estado y una tarjeta por ticket, con
 * el trabajador que lo tiene asignado. «Falló» solo aparece si hay alguno.
 */
@Component({
  selector: 'app-ticket-board',
  imports: [Avatar, Badge, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-board.html',
  styleUrl: './ticket-board.scss',
})
export class TicketBoard {
  readonly cards = input.required<readonly BoardCard[]>();
  /** El ticket abierto en el panel, para resaltarlo. */
  readonly selectedId = input<string | null>(null);
  /** La ejecución está en marcha: las tarjetas que se están trabajando muestran que trabajan. */
  readonly running = input(false);

  readonly open = output<string>();

  protected readonly columns = computed(() =>
    COLUMNS.map((column) => ({
      ...column,
      cards: this.cards().filter((card) => card.ticket.status === column.status),
    })).filter((column) => column.status !== 'failed' || column.cards.length > 0),
  );

  protected isWorking(card: BoardCard): boolean {
    return this.running() && ['developing', 'reviewing'].includes(card.ticket.status);
  }
}
