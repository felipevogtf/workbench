import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DiffHunk as Hunk } from '../../models/diff';

/**
 * `split`: dos columnas, el código de antes a la izquierda y el de después a la derecha.
 * `new` / `old`: una sola columna, para archivos añadidos (solo hay código nuevo) o eliminados
 * (solo hay código viejo), donde no hay nada que comparar.
 */
export type DiffHunkMode = 'split' | 'new' | 'old';

/**
 * Un hunk del diff, normalmente en dos columnas.
 * Slot `[hunk-actions]`: acciones sobre el segmento, junto a su encabezado.
 */
@Component({
  selector: 'app-diff-hunk',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diff-hunk.html',
  styleUrl: './diff-hunk.scss',
})
export class DiffHunk {
  readonly hunk = input.required<Hunk>();
  readonly mode = input<DiffHunkMode>('split');

  /** En una sola columna no se dibujan las filas que no tienen nada de ese lado (los espacios grises). */
  protected readonly rows = computed(() => {
    const rows = this.hunk().rows;
    const mode = this.mode();
    if (mode === 'old') return rows.filter((row) => row.left);
    if (mode === 'new') return rows.filter((row) => row.right);
    return rows;
  });
}
