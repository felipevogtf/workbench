import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { DiffFile, STATUS_TONE } from '../../components/diff-file/diff-file';
import { SplitHandle } from '../../components/split-handle/split-handle';
import { PullRequestDiffStore } from '../../data-access/pull-request-diff.store';
import { DIFF_STATUS_LABEL } from '../../models/diff';
import { PROVIDER_LABEL } from '../../models/pull-request';

const FILES_DEFAULT_PX = 300;
const FILES_MIN_PX = 220;
const FILES_MAX_PX = 560;
/** Lo mínimo que debe quedarle al código al ensanchar la lista de archivos. */
const CODE_MIN_PX = 480;
const FILES_STEP_PX = 20;
/** Ancho del divisor entre la lista y el código. */
const HANDLE_PX = 10;

/**
 * Cambios de una PR a pantalla completa: lista de archivos a la izquierda y su diff lado a lado a la
 * derecha. Dos divisores permiten repartir el ancho: lista/código y código de antes/de después.
 */
@Component({
  selector: 'app-pull-request-diff-page',
  imports: [
    RouterLink,
    PageHeader,
    Button,
    Card,
    Icon,
    Alert,
    Badge,
    Skeleton,
    DiffFile,
    SplitHandle,
  ],
  providers: [PullRequestDiffStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-request-diff-page.html',
  styleUrl: './pull-request-diff-page.scss',
})
export class PullRequestDiffPage {
  /** Viene de la ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly store = inject(PullRequestDiffStore);
  protected readonly providerLabel = PROVIDER_LABEL;
  protected readonly statusLabel = DIFF_STATUS_LABEL;
  protected readonly statusTone = STATUS_TONE;

  /** Ancho de la lista de archivos. */
  protected readonly filesWidth = signal(FILES_DEFAULT_PX);
  /** Porcentaje del código que se lleva el lado de antes; se conserva al cambiar de archivo. */
  protected readonly split = signal(50);

  private readonly layout = viewChild<ElementRef<HTMLElement>>('layout');

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
  }

  protected dragFiles(clientX: number): void {
    const element = this.layout()?.nativeElement;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    this.setFilesWidth(clientX - rect.left - HANDLE_PX / 2, rect.width);
  }

  protected nudgeFiles(direction: -1 | 1): void {
    const element = this.layout()?.nativeElement;
    if (!element) return;

    this.setFilesWidth(this.filesWidth() + direction * FILES_STEP_PX, element.clientWidth);
  }

  private setFilesWidth(width: number, containerWidth: number): void {
    const max = Math.min(FILES_MAX_PX, containerWidth - HANDLE_PX - CODE_MIN_PX);
    this.filesWidth.set(Math.max(FILES_MIN_PX, Math.min(max, width)));
  }
}
