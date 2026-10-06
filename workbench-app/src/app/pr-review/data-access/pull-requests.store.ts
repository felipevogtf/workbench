import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { exhaustMap, filter, from, timer } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import {
  PullRequest,
  PullRequestFilters,
  QueueSnapshot,
  ReReviewRequest,
  SyncResult,
  isActive,
} from '../models/pull-request';
import { PullRequestsApi } from './pull-requests.api';

export const POLL_INTERVAL_MS = 3000;

const DEFAULT_FILTERS: PullRequestFilters = { status: 'all', provider: 'all', staleOnly: false };

/** Estado de la lista de PRs y de la cola de revisión. */
@Injectable({ providedIn: 'root' })
export class PullRequestsStore {
  private readonly api = inject(PullRequestsApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<PullRequest[]>([]);
  private readonly queueState = signal<QueueSnapshot | null>(null);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly syncingState = signal(false);
  private readonly filtersState = signal<PullRequestFilters>(DEFAULT_FILTERS);

  /** Las omitidas solo se muestran en su pestaña, para no estorbar la revisión del día a día. */
  readonly pullRequests = computed(() =>
    this.filtersState().status === 'skipped'
      ? this.items()
      : this.items().filter((pr) => pr.status !== 'skipped'),
  );
  readonly queue = this.queueState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly syncing = this.syncingState.asReadonly();
  readonly filters = this.filtersState.asReadonly();

  /** Hay PRs en cola o en curso: mientras sea true, la lista se refresca sola. */
  readonly hasActiveWork = computed(() => {
    const queue = this.queueState();
    const inQueue = !!queue && queue.reviewing.length + queue.pending.length > 0;
    return inQueue || this.items().some((pr) => isActive(pr.status));
  });

  async load(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      await this.fetch();
      this.loadedState.set(true);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  setFilters(patch: Partial<PullRequestFilters>): void {
    this.filtersState.update((current) => ({ ...current, ...patch }));
    void this.load();
  }

  async sync(): Promise<SyncResult | null> {
    this.syncingState.set(true);
    try {
      const result = await firstValueFrom(this.api.sync());
      this.toast.success(
        `Sincronizado: ${result.created} nuevas, ${result.updated} actualizadas, ${result.closed} cerradas`,
      );
      await this.load();
      return result;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return null;
    } finally {
      this.syncingState.set(false);
    }
  }

  /** Encola una re-revisión. Responde de inmediato: el resultado llega por polling. */
  async reReview(pullRequest: PullRequest, request: ReReviewRequest): Promise<boolean> {
    try {
      const queued = await firstValueFrom(this.api.reReview(pullRequest.id, request));
      this.items.update((list) => list.map((pr) => (pr.id === queued.id ? queued : pr)));
      this.toast.success('Re-revisión en cola');
      await this.refresh();
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  /**
   * Refresca lista y cola mientras haya trabajo activo y la pestaña esté visible.
   * Se detiene con el `DestroyRef` recibido (el de la página que lo usa).
   */
  startPolling(destroyRef: DestroyRef): void {
    const subscription = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        filter(() => this.hasActiveWork() && document.visibilityState === 'visible'),
        exhaustMap(() => from(this.refresh())),
      )
      .subscribe();
    destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  /** Refresco silencioso: no muestra spinner ni borra lo que ya hay si falla. */
  async refresh(): Promise<void> {
    try {
      await this.fetch();
    } catch {
      // El siguiente ciclo reintenta.
    }
  }

  private async fetch(): Promise<void> {
    const [list, queue] = await Promise.all([
      firstValueFrom(this.api.list(this.filtersState())),
      firstValueFrom(this.api.queue()),
    ]);
    this.items.set(list);
    this.queueState.set(queue);
  }
}
