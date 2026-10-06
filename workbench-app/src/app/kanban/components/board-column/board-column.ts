import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Issue } from '@tasks/index';
import { Column } from '../../domain/board-columns';
import { BoardCardItem } from '../board-card/board-card';

export interface ColumnMove {
  issueId: string;
  targetKey: string;
}

/** Una columna del tablero (un estado). Arrastrar y soltar con el CDK; el menú es la alternativa. */
@Component({
  selector: 'app-board-column',
  imports: [CdkDropList, CdkDrag, BoardCardItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-column.html',
  styleUrl: './board-column.scss',
})
export class BoardColumn {
  readonly column = input.required<Column>();
  readonly issues = input.required<ReadonlyMap<string, Issue>>();
  /** Todas las columnas del tablero (para el menú «Mover a…»). */
  readonly columns = input.required<readonly Column[]>();

  readonly dropped = output<CdkDragDrop<string, string, string>>();
  readonly moved = output<ColumnMove>();
  readonly removed = output<string>();

  /** En pantallas táctiles el arrastre exige mantener pulsado, para no chocar con el scroll. */
  protected readonly dragDelay = { touch: 250, mouse: 0 };

  protected readonly cards = computed(() =>
    this.column().issueIds.flatMap((id) => {
      const issue = this.issues().get(id);
      return issue ? [issue] : [];
    }),
  );
  protected readonly targets = computed(() =>
    this.columns().filter((column) => column.key !== this.column().key),
  );
}
