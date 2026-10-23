import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  model,
  output,
  viewChild,
} from '@angular/core';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import {
  DIFF_STATUS_LABEL,
  DiffFile as File,
  DiffFileStatus,
  DiffHunk as HunkData,
  countRows,
} from '../../models/diff';
import { DiffHunk, DiffHunkMode } from '../diff-hunk/diff-hunk';
import { SplitHandle } from '../split-handle/split-handle';

/** A partir de este número de filas el diff de un archivo se pide mostrar a mano, para no trabar la página. */
export const LARGE_FILE_ROWS = 1500;

/** Ancho de cada columna de números de línea; debe coincidir con `--num-col` de los estilos. */
const NUM_COL_REM = 3.25;
/** Borde de cada hunk, que queda entre su caja y sus columnas. */
const HUNK_BORDER_PX = 1;
const MIN_SPLIT = 15;
const MAX_SPLIT = 85;
const SPLIT_STEP = 2;

const clampSplit = (value: number) => Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value));

export const STATUS_TONE: Record<DiffFileStatus, BadgeTone> = {
  added: 'success',
  deleted: 'danger',
  renamed: 'info',
  modified: 'neutral',
};

/**
 * Un archivo del diff: su encabezado y sus hunks lado a lado, con un divisor para repartir el ancho
 * entre el código de antes y el de después.
 */
@Component({
  selector: 'app-diff-file',
  imports: [Badge, Button, DiffHunk, Icon, IconButton, SplitHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--split]': 'split()' },
  templateUrl: './diff-file.html',
  styleUrl: './diff-file.scss',
})
export class DiffFile {
  readonly file = input.required<File>();
  /** Porcentaje del ancho que se lleva el código de la izquierda (antes). */
  readonly split = model(50);
  /** Se pidió explicar un segmento con la IA. */
  readonly explain = output<HunkData>();

  private readonly hunksEl = viewChild<ElementRef<HTMLElement>>('hunks');

  protected readonly statusLabel = DIFF_STATUS_LABEL;
  protected readonly statusTone = STATUS_TONE;

  protected readonly rows = computed(() => countRows(this.file()));

  /** Un archivo añadido o eliminado no tiene con qué compararse: una sola columna y sin divisor. */
  protected readonly mode = computed<DiffHunkMode>(() => {
    const status = this.file().status;
    return status === 'added' ? 'new' : status === 'deleted' ? 'old' : 'split';
  });

  /** Se reinicia al cambiar de archivo: mostrar uno grande no abre los demás. */
  private readonly forceShow = linkedSignal<File, boolean>({
    source: this.file,
    computation: () => false,
  });

  protected readonly collapsed = computed(() => this.rows() > LARGE_FILE_ROWS && !this.forceShow());

  protected show(): void {
    this.forceShow.set(true);
  }

  /** Convierte la posición del puntero en el porcentaje de la columna izquierda. */
  protected drag(clientX: number): void {
    const element = this.hunksEl()?.nativeElement;
    if (!element) return;

    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const numColumn = NUM_COL_REM * rootFontSize;
    const rect = element.getBoundingClientRect();
    const codeWidth = rect.width - 2 * HUNK_BORDER_PX - 2 * numColumn;
    if (codeWidth <= 0) return;

    const offset = clientX - rect.left - HUNK_BORDER_PX - numColumn;
    this.split.set(clampSplit((offset / codeWidth) * 100));
  }

  protected nudge(direction: -1 | 1): void {
    this.split.update((value) => clampSplit(value + direction * SPLIT_STEP));
  }
}
