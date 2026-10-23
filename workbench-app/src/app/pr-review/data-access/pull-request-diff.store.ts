import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { DiffFile, parseUnifiedDiff } from '../models/diff';
import { buildFullHunk, FullFileMismatchError, FullFileState } from '../models/diff-full';
import { buildFileTree, treeOrder } from '../models/diff-tree';
import { PullRequestDetail } from '../models/pull-request';
import { PullRequestsApi } from './pull-requests.api';

/** Estado de la pantalla de diff. Se provee a nivel de página, así que cada visita parte limpia. */
@Injectable()
export class PullRequestDiffStore {
  private readonly api = inject(PullRequestsApi);

  private readonly detailState = signal<PullRequestDetail | null>(null);
  private readonly diffState = signal('');
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly selectedPathState = signal<string | null>(null);
  /** El archivo completo de cada archivo que se pidió ver así, por ruta. */
  private readonly fullFilesState = signal<ReadonlyMap<string, FullFileState>>(new Map());

  readonly detail = this.detailState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly files = computed(() => parseUnifiedDiff(this.diffState()));
  readonly additions = computed(() => this.files().reduce((sum, f) => sum + f.additions, 0));
  readonly deletions = computed(() => this.files().reduce((sum, f) => sum + f.deletions, 0));

  /** Los archivos agrupados por carpeta, como se muestran. */
  readonly tree = computed(() => buildFileTree(this.files()));

  /** El archivo elegido; mientras no se elija ninguno (o si desapareció), el primero del árbol. */
  readonly selected = computed(() => {
    const files = treeOrder(this.tree());
    const path = this.selectedPathState();
    return files.find((file) => file.path === path) ?? files[0] ?? null;
  });

  /** El «archivo completo» del archivo elegido, si se pidió. */
  readonly fullState = computed<FullFileState | null>(() => {
    const selected = this.selected();
    return selected ? (this.fullFilesState().get(selected.path) ?? null) : null;
  });

  async load(id: string): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [detail, diff] = await Promise.all([
        firstValueFrom(this.api.get(id)),
        firstValueFrom(this.api.diff(id)),
      ]);
      this.detailState.set(detail);
      this.diffState.set(diff);
      this.selectedPathState.set(null);
      this.fullFilesState.set(new Map());
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  select(path: string): void {
    this.selectedPathState.set(path);
  }

  /**
   * Prepara el archivo entero de un archivo del diff. Uno añadido o eliminado ya lo trae el diff; para el
   * resto se pide su versión nueva al proveedor y lo de antes sale de deshacer los cambios. Si ya se
   * cargó (o está cargándose) no hace nada; si falló, vuelve a intentarlo.
   */
  async loadFull(file: DiffFile): Promise<void> {
    const id = this.detailState()?.id;
    const current = this.fullFilesState().get(file.path);
    if (!id || current?.status === 'ready' || current?.status === 'loading') return;

    this.setFull(file.path, { status: 'loading' });
    try {
      const needsContent = file.status === 'modified' || file.status === 'renamed';
      const text = needsContent ? await firstValueFrom(this.api.file(id, file.path)) : null;
      this.setFull(file.path, { status: 'ready', hunk: buildFullHunk(file, text) });
    } catch (error) {
      const message = error instanceof FullFileMismatchError ? error.message : errorMessage(error);
      this.setFull(file.path, { status: 'error', message });
    }
  }

  private setFull(path: string, state: FullFileState): void {
    this.fullFilesState.update((current) => new Map(current).set(path, state));
  }
}
