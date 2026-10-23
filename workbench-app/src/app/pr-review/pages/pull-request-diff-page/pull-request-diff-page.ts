import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { IconName } from '@shared/ui/icon/icons';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { DiffFile } from '../../components/diff-file/diff-file';
import { PrChat } from '../../components/pr-chat/pr-chat';
import { SplitHandle } from '../../components/split-handle/split-handle';
import { PullRequestChatStore } from '../../data-access/pull-request-chat.store';
import { PullRequestDiffStore } from '../../data-access/pull-request-diff.store';
import { buildExplainMessage } from '../../models/chat';
import {
  DIFF_STATUS_LABEL,
  DiffFile as DiffFileData,
  DiffFileStatus,
  DiffHunk,
  canCompare,
} from '../../models/diff';
import { flattenTree } from '../../models/diff-tree';
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
    Skeleton,
    DiffFile,
    PrChat,
    SplitHandle,
  ],
  providers: [PullRequestDiffStore, PullRequestChatStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-request-diff-page.html',
  styleUrl: './pull-request-diff-page.scss',
})
export class PullRequestDiffPage {
  /** Viene de la ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly store = inject(PullRequestDiffStore);
  private readonly chat = inject(PullRequestChatStore);
  protected readonly providerLabel = PROVIDER_LABEL;
  protected readonly statusLabel = DIFF_STATUS_LABEL;
  /** Añadido lleva «+», eliminado «X» y el resto (modificado, renombrado) el archivo a secas. */
  protected readonly fileIcon: Record<DiffFileStatus, IconName> = {
    added: 'file-plus',
    deleted: 'file-x',
    modified: 'file',
    renamed: 'file',
  };

  /** Ancho de la lista de archivos. */
  protected readonly filesWidth = signal(FILES_DEFAULT_PX);
  /** Porcentaje del código que se lleva el lado de antes; se conserva al cambiar de archivo. */
  protected readonly split = signal(50);
  /** Cada lado con su propio scroll y sin espacios grises; se conserva al cambiar de archivo. */
  protected readonly independentScroll = signal(false);

  /** Con scroll independiente el archivo debe ocupar todo el alto de su zona (solo si hay dos lados). */
  protected readonly fillsHeight = computed(() => {
    const file = this.store.selected();
    return this.independentScroll() && !!file && canCompare(file);
  });

  /** Rutas de las carpetas plegadas; todas parten abiertas. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  protected readonly rows = computed(() => flattenTree(this.store.tree(), this.collapsed()));

  private readonly layout = viewChild<ElementRef<HTMLElement>>('layout');

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        void this.store.load(id);
        this.chat.bind(id);
      });
    });
  }

  /** El botón de IA de un segmento: abre el chat y le pide que lo explique. */
  protected explainHunk(file: DiffFileData, hunk: DiffHunk): void {
    void this.chat.ask(buildExplainMessage(file, hunk));
  }

  protected toggleFolder(path: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
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
