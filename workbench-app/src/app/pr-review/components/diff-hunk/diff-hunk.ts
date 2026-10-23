import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DiffHunk as Hunk } from '../../models/diff';

/**
 * Un hunk del diff en dos columnas: el código de antes a la izquierda y el de después a la derecha.
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
}
