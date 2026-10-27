import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { SessionFormDialog } from '../../components/session-form-dialog/session-form-dialog';
import { OrganizerStore } from '../../data-access/organizer.store';
import { OrganizerSession } from '../../models/organizer';

/** El organizador (`/organizer`): sesiones para planificar y ejecutar varias tareas relacionadas juntas. */
@Component({
  selector: 'app-organizer-list-page',
  imports: [
    RouterLink,
    TimeAgoPipe,
    Alert,
    Button,
    Card,
    EmptyState,
    Icon,
    PageHeader,
    Skeleton,
    SessionFormDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organizer-list-page.html',
  styleUrl: './organizer-list-page.scss',
})
export class OrganizerListPage {
  protected readonly store = inject(OrganizerStore);
  private readonly router = inject(Router);

  protected readonly formOpen = signal(false);

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected async onCreated(session: OrganizerSession): Promise<void> {
    await this.router.navigate(['/organizer', session.id]);
  }
}
