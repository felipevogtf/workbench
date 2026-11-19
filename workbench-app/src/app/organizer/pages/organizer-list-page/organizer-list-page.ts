import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { OrganizerStore } from '../../data-access/organizer.store';

/** El organizador (`/organizer`): las conversaciones con la IA para planificar y ejecutar, con los proyectos y tickets que se les sumen. */
@Component({
  selector: 'app-organizer-list-page',
  imports: [RouterLink, TimeAgoPipe, Alert, Button, EmptyState, Icon, PageHeader, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organizer-list-page.html',
  styleUrl: './organizer-list-page.scss',
})
export class OrganizerListPage {
  protected readonly store = inject(OrganizerStore);

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }
}
