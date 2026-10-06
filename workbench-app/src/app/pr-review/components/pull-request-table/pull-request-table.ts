import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { PROVIDER_LABEL, PullRequest } from '../../models/pull-request';
import { ProviderIcon } from '../provider-icon/provider-icon';
import { StatusBadge } from '../status-badge/status-badge';
import { TicketTags } from '../ticket-tags/ticket-tags';

/** Tabla desde 768px; lista de cards por debajo. */
@Component({
  selector: 'app-pull-request-table',
  imports: [
    RouterLink,
    TimeAgoPipe,
    Button,
    Card,
    Icon,
    IconButton,
    ProviderIcon,
    StatusBadge,
    TicketTags,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-request-table.html',
  styleUrl: './pull-request-table.scss',
})
export class PullRequestTable {
  readonly items = input.required<readonly PullRequest[]>();

  readonly reReview = output<PullRequest>();

  protected readonly providerLabel = PROVIDER_LABEL;

  protected canReReview(pr: PullRequest): boolean {
    return pr.state === 'open' && pr.status !== 'reviewing';
  }
}
