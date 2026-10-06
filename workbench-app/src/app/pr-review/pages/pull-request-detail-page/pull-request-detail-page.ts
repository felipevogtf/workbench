import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgentsStore } from '@ai-agents/index';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Toast } from '@shared/ui/toast/toast';
import { downloadText } from '@shared/util/download-text';
import { PullRequestDetailStore } from '../../data-access/pull-request-detail.store';
import { ProviderIcon } from '../../components/provider-icon/provider-icon';
import { ReReviewDialog } from '../../components/re-review-dialog/re-review-dialog';
import { ReviewHistory } from '../../components/review-history/review-history';
import { StatusBadge } from '../../components/status-badge/status-badge';
import { PROVIDER_LABEL, ReReviewRequest, Review, shortCommit } from '../../models/pull-request';

@Component({
  selector: 'app-pull-request-detail-page',
  imports: [
    RouterLink,
    TimeAgoPipe,
    PageHeader,
    Button,
    Card,
    Icon,
    Alert,
    Skeleton,
    MarkdownViewer,
    ProviderIcon,
    StatusBadge,
    ReviewHistory,
    ReReviewDialog,
  ],
  providers: [PullRequestDetailStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-request-detail-page.html',
  styleUrl: './pull-request-detail-page.scss',
})
export class PullRequestDetailPage {
  /** Viene de la ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly store = inject(PullRequestDetailStore);
  protected readonly agentsStore = inject(AgentsStore);
  private readonly toast = inject(Toast);

  protected readonly dialogOpen = signal(false);
  protected readonly short = shortCommit;
  protected readonly providerLabel = PROVIDER_LABEL;

  protected readonly canReReview = computed(() => {
    const detail = this.store.detail();
    return !!detail && detail.state === 'open' && detail.status !== 'reviewing';
  });

  constructor() {
    void this.agentsStore.load();

    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
  }

  protected selectReview(review: Review): void {
    void this.store.selectReview(review);
  }

  protected reReview(request: ReReviewRequest): void {
    void this.store.reReview(request);
  }

  protected retryComment(): void {
    void this.store.retryComment();
  }

  protected async copy(markdown: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(markdown);
      this.toast.success('Revisión copiada');
    } catch {
      this.toast.error('No se pudo copiar al portapapeles');
    }
  }

  protected download(markdown: string): void {
    const detail = this.store.detail();
    if (!detail) return;
    const repo = detail.repo.replace('/', '-');
    downloadText(`${repo}-${detail.externalId}.md`, markdown);
  }
}
