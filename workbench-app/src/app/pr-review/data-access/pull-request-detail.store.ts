import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { exhaustMap, filter, firstValueFrom, from, timer } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { PullRequestDetail, ReReviewRequest, Review, isActive } from '../models/pull-request';
import { PullRequestsApi } from './pull-requests.api';
import { POLL_INTERVAL_MS } from './pull-requests.store';

/**
 * Estado de la pantalla de detalle. Se provee a nivel de página (`providers: [...]`), así que cada
 * visita parte limpia y su polling se detiene al salir.
 */
@Injectable()
export class PullRequestDetailStore {
  private readonly api = inject(PullRequestsApi);
  private readonly toast = inject(Toast);
  private readonly destroyRef = inject(DestroyRef);

  private readonly detailState = signal<PullRequestDetail | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly selectedState = signal<string | null>(null);
  private readonly markdownState = signal<string | null>(null);
  private readonly markdownLoadingState = signal(false);
  private readonly markdownErrorState = signal<string | null>(null);
  private readonly positionState = signal<number | null>(null);
  private readonly actingState = signal(false);
  private pollingStarted = false;

  readonly detail = this.detailState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly selectedReviewId = this.selectedState.asReadonly();
  readonly markdown = this.markdownState.asReadonly();
  readonly markdownLoading = this.markdownLoadingState.asReadonly();
  readonly markdownError = this.markdownErrorState.asReadonly();
  /** Lugar en la cola (1 = siguiente en revisarse); solo si está `pending`. */
  readonly queuePosition = this.positionState.asReadonly();
  readonly acting = this.actingState.asReadonly();

  readonly isActive = computed(() => {
    const detail = this.detailState();
    return !!detail && isActive(detail.status);
  });

  /** Última revisión con comentario sin publicar (para ofrecer "Reintentar comentario"). */
  readonly commentToRetry = computed<Review | null>(() => {
    const latest = this.detailState()?.reviews.find((review) => review.status === 'ok');
    return latest && latest.commentStatus !== 'posted' ? latest : null;
  });

  async load(id: string): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const detail = await firstValueFrom(this.api.get(id));
      this.detailState.set(detail);
      await this.selectDefaultReview(detail);
      await this.updateQueuePosition(detail);
      this.startPolling();
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  async selectReview(review: Review): Promise<void> {
    const detail = this.detailState();
    if (!detail || review.status !== 'ok') return;

    this.selectedState.set(review.id);
    this.markdownLoadingState.set(true);
    this.markdownErrorState.set(null);
    try {
      this.markdownState.set(await firstValueFrom(this.api.review(detail.id, review.id)));
    } catch (error) {
      this.markdownState.set(null);
      this.markdownErrorState.set(errorMessage(error));
    } finally {
      this.markdownLoadingState.set(false);
    }
  }

  async reReview(request: ReReviewRequest): Promise<boolean> {
    const detail = this.detailState();
    if (!detail) return false;

    this.actingState.set(true);
    try {
      const queued = await firstValueFrom(this.api.reReview(detail.id, request));
      this.detailState.update((current) => (current ? { ...current, ...queued } : current));
      this.toast.success('Re-revisión en cola');
      await this.updateQueuePosition(this.detailState());
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    } finally {
      this.actingState.set(false);
    }
  }

  async retryComment(): Promise<void> {
    const detail = this.detailState();
    if (!detail) return;

    this.actingState.set(true);
    try {
      const review = await firstValueFrom(this.api.retryComment(detail.id));
      this.toast.success(
        review.commentStatus === 'posted'
          ? 'Comentario publicado'
          : 'No se pudo publicar el comentario',
      );
      await this.refresh();
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.actingState.set(false);
    }
  }

  /** Refresco silencioso; si la PR terminó de revisarse, carga la revisión nueva. */
  private async refresh(): Promise<void> {
    const current = this.detailState();
    if (!current) return;

    try {
      const detail = await firstValueFrom(this.api.get(current.id));
      const finished = isActive(current.status) && !isActive(detail.status);
      this.detailState.set(detail);
      if (finished || this.selectedState() === null) {
        await this.selectDefaultReview(detail);
      }
      await this.updateQueuePosition(detail);
    } catch {
      // El siguiente ciclo reintenta.
    }
  }

  private async selectDefaultReview(detail: PullRequestDetail): Promise<void> {
    const latest = detail.reviews.find((review) => review.status === 'ok');
    if (latest) {
      await this.selectReview(latest);
    } else {
      this.selectedState.set(null);
      this.markdownState.set(null);
    }
  }

  private async updateQueuePosition(detail: PullRequestDetail | null): Promise<void> {
    if (!detail || detail.status !== 'pending') {
      this.positionState.set(null);
      return;
    }
    try {
      const queue = await firstValueFrom(this.api.queue());
      const index = queue.pending.findIndex((pr) => pr.id === detail.id);
      this.positionState.set(index === -1 ? null : index + 1);
    } catch {
      this.positionState.set(null);
    }
  }

  private startPolling(): void {
    if (this.pollingStarted) return;
    this.pollingStarted = true;

    const subscription = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        filter(() => this.isActive() && document.visibilityState === 'visible'),
        exhaustMap(() => from(this.refresh())),
      )
      .subscribe();
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }
}
