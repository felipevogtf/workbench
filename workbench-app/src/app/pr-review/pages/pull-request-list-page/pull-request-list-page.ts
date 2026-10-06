import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AgentsStore } from '@ai-agents/index';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SegmentedControl, SegmentOption } from '@shared/ui/segmented-control/segmented-control';
import { Select, SelectOption } from '@shared/ui/select/select';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { PullRequestsStore } from '../../data-access/pull-requests.store';
import { PullRequestTable } from '../../components/pull-request-table/pull-request-table';
import { QueuePanel } from '../../components/queue-panel/queue-panel';
import { ReReviewDialog } from '../../components/re-review-dialog/re-review-dialog';
import {
  GitProvider,
  PullRequest,
  PullRequestStatus,
  ReReviewRequest,
} from '../../models/pull-request';

const STATUS_OPTIONS: SegmentOption[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'En cola' },
  { value: 'reviewing', label: 'Revisando' },
  { value: 'reviewed', label: 'Revisadas' },
  { value: 'failed', label: 'Fallidas' },
  { value: 'skipped', label: 'Omitidas' },
];

const PROVIDER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Todos los proveedores' },
  { value: 'bitbucket', label: 'Bitbucket' },
  { value: 'github', label: 'GitHub' },
];

@Component({
  selector: 'app-pull-request-list-page',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    Button,
    Icon,
    Alert,
    EmptyState,
    Skeleton,
    SegmentedControl,
    Select,
    Checkbox,
    FormField,
    PullRequestTable,
    QueuePanel,
    ReReviewDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-request-list-page.html',
  styleUrl: './pull-request-list-page.scss',
})
export class PullRequestListPage {
  protected readonly store = inject(PullRequestsStore);
  protected readonly agentsStore = inject(AgentsStore);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly providerOptions = PROVIDER_OPTIONS;
  protected readonly providerControl = new FormControl<string>('all', { nonNullable: true });

  protected readonly reReviewTarget = signal<PullRequest | null>(null);
  protected readonly dialogOpen = signal(false);

  protected readonly hasFilters = computed(() => {
    const { status, provider, staleOnly } = this.store.filters();
    return status !== 'all' || provider !== 'all' || staleOnly;
  });

  protected readonly queueHasWork = computed(() => {
    const queue = this.store.queue();
    return !!queue && queue.reviewing.length + queue.pending.length > 0;
  });

  constructor() {
    void this.store.load();
    void this.agentsStore.load();
    this.store.startPolling(inject(DestroyRef));

    this.providerControl.setValue(this.store.filters().provider, { emitEvent: false });
    this.providerControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((provider) =>
        this.store.setFilters({ provider: provider as GitProvider | 'all' }),
      );
  }

  protected setStatus(status: string): void {
    this.store.setFilters({ status: status as PullRequestStatus | 'all' });
  }

  protected setStaleOnly(staleOnly: boolean): void {
    this.store.setFilters({ staleOnly });
  }

  protected sync(): void {
    void this.store.sync();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected askReReview(pullRequest: PullRequest): void {
    this.reReviewTarget.set(pullRequest);
    this.dialogOpen.set(true);
  }

  protected reReview(request: ReReviewRequest): void {
    const target = this.reReviewTarget();
    if (target) void this.store.reReview(target, request);
  }
}
