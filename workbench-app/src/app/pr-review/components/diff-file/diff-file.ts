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
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Spinner } from '@shared/ui/spinner/spinner';
import {
  DIFF_STATUS_LABEL,
  DiffFile as File,
  DiffFileStatus,
  DiffHunk as HunkData,
  canCompare,
} from '../../models/diff';
import { FullFileState } from '../../models/diff-full';
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
 *
 * - «Archivo completo» reemplaza los segmentos por todas las líneas del archivo (el contenido lo pide
 *   quien usa el componente al recibir `fullRequested` y lo devuelve en `fullState`).
 * - «Desincronizar scroll» separa los dos lados en paneles con su propio scroll y sin las filas vacías
 *   (los espacios grises) que mantienen alineados los dos lados.
 */
@Component({
  selector: 'app-diff-file',
  imports: [Badge, Button, Checkbox, DiffHunk, Icon, IconButton, Spinner, SplitHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--split]': 'split()',
    '[class.is-independent]': 'independent()',
  },
  templateUrl: './diff-file.html',
  styleUrl: './diff-file.scss',
})
export class DiffFile {
  readonly file = input.required<File>();
  /** El archivo entero (de quien lo pidió con `fullRequested`); sin valor mientras no se haya pedido. */
  readonly fullState = input<FullFileState | null>(null);
  /** Porcentaje del ancho que se lleva el código de la izquierda (antes). */
  readonly split = model(50);
  /** Se ve el archivo entero en vez de solo los segmentos con cambios. */
  readonly full = model(false);
  /** Cada lado con su propio scroll y sin filas vacías; solo aplica al ver el archivo completo. */
  readonly independentScroll = model(false);
  /** Se pidió explicar un segmento con la IA. */
  readonly explain = output<HunkData>();
  /** Se pidió ver el archivo completo: hay que traer su contenido. */
  readonly fullRequested = output<void>();

  private readonly hunksEl = viewChild<ElementRef<HTMLElement>>('hunks');

  protected readonly statusLabel = DIFF_STATUS_LABEL;
  protected readonly statusTone = STATUS_TONE;

  /** Un archivo añadido o eliminado no tiene con qué compararse: una sola columna y sin divisor. */
  protected readonly mode = computed<DiffHunkMode>(() => {
    const status = this.file().status;
    return status === 'added' ? 'new' : status === 'deleted' ? 'old' : 'split';
  });

  protected readonly comparable = computed(() => canCompare(this.file()));
  protected readonly hasContent = computed(
    () => !this.file().binary && this.file().hunks.length > 0,
  );
  protected readonly independent = computed(
    () => this.independentScroll() && this.full() && this.mode() === 'split',
  );

  protected readonly fullError = computed(() => {
    const state = this.fullState();
    return this.full() && state?.status === 'error' ? state.message : null;
  });

  /** Los segmentos que se dibujan: los del diff o, en «archivo completo», uno solo con todo el archivo. */
  protected readonly shownHunks = computed<HunkData[]>(() => {
    if (!this.full()) return this.file().hunks;
    const state = this.fullState();
    return state?.status === 'ready' ? [state.hunk] : [];
  });

  protected readonly rows = computed(() =>
    this.shownHunks().reduce((total, hunk) => total + hunk.rows.length, 0),
  );

  /** Se reinicia al cambiar de archivo: mostrar uno grande no abre los demás. */
  private readonly forceShow = linkedSignal<File, boolean>({
    source: this.file,
    computation: () => false,
  });

  protected readonly collapsed = computed(() => this.rows() > LARGE_FILE_ROWS && !this.forceShow());

  protected show(): void {
    this.forceShow.set(true);
  }

  protected toggleFull(): void {
    const next = !this.full();
    this.full.set(next);
    if (next) this.fullRequested.emit();
  }

  /** Convierte la posición del puntero en el porcentaje de la columna izquierda. */
  protected drag(clientX: number): void {
    const element = this.hunksEl()?.nativeElement;
    if (!element) return;
    const rect = element.getBoundingClientRect();

    if (this.independent()) {
      // Paneles separados: la columna izquierda es un porcentaje directo del ancho.
      if (rect.width <= 0) return;
      this.split.set(clampSplit(((clientX - rect.left) / rect.width) * 100));
      return;
    }

    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const numColumn = NUM_COL_REM * rootFontSize;
    const codeWidth = rect.width - 2 * HUNK_BORDER_PX - 2 * numColumn;
    if (codeWidth <= 0) return;

    const offset = clientX - rect.left - HUNK_BORDER_PX - numColumn;
    this.split.set(clampSplit((offset / codeWidth) * 100));
  }

  protected nudge(direction: -1 | 1): void {
    this.split.update((value) => clampSplit(value + direction * SPLIT_STEP));
  }
}
