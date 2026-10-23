import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { DIFF_STATUS_LABEL, DiffFile as File, DiffFileStatus, countRows } from '../../models/diff';
import { DiffHunk } from '../diff-hunk/diff-hunk';

/** A partir de este número de filas el diff de un archivo se pide mostrar a mano, para no trabar la página. */
export const LARGE_FILE_ROWS = 1500;

export const STATUS_TONE: Record<DiffFileStatus, BadgeTone> = {
  added: 'success',
  deleted: 'danger',
  renamed: 'info',
  modified: 'neutral',
};

/** Un archivo del diff: su encabezado y sus hunks lado a lado. */
@Component({
  selector: 'app-diff-file',
  imports: [Badge, Button, DiffHunk],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diff-file.html',
  styleUrl: './diff-file.scss',
})
export class DiffFile {
  readonly file = input.required<File>();

  protected readonly statusLabel = DIFF_STATUS_LABEL;
  protected readonly statusTone = STATUS_TONE;

  protected readonly rows = computed(() => countRows(this.file()));

  /** Se reinicia al cambiar de archivo: mostrar uno grande no abre los demás. */
  private readonly forceShow = linkedSignal<File, boolean>({
    source: this.file,
    computation: () => false,
  });

  protected readonly collapsed = computed(() => this.rows() > LARGE_FILE_ROWS && !this.forceShow());

  protected show(): void {
    this.forceShow.set(true);
  }
}
