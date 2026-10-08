import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SegmentedControl, SegmentOption } from '@shared/ui/segmented-control/segmented-control';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { TextInput } from '@shared/ui/text-input/text-input';
import { formatDay, formatHours } from '@shared/util/date';
import { HoursByDay } from '../../components/hours-by-day/hours-by-day';
import { TicketsByProject } from '../../components/tickets-by-project/tickets-by-project';
import { DashboardStore } from '../../data-access/dashboard.store';
import { PeriodMode, periodLabel } from '../../domain/period';

const MODE_OPTIONS: SegmentOption[] = [
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensual' },
  { value: 'range', label: 'Rango de fechas' },
];

/** Dashboard (`/dashboard`): las horas registradas del período, por día y por ticket de cada proyecto. */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    SegmentedControl,
    FormField,
    TextInput,
    Button,
    IconButton,
    Icon,
    Card,
    Alert,
    EmptyState,
    Skeleton,
    HoursByDay,
    TicketsByProject,
  ],
  providers: [DashboardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  protected readonly store = inject(DashboardStore);

  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly formatHours = formatHours;
  protected readonly formatDay = formatDay;

  protected readonly fromControl = new FormControl(this.store.customRange().from, {
    nonNullable: true,
  });
  protected readonly toControl = new FormControl(this.store.customRange().to, {
    nonNullable: true,
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.fromControl.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((from) => this.store.setCustomRange({ from }));
    this.toControl.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((to) => this.store.setCustomRange({ to }));
  }

  protected setMode(mode: string): void {
    this.store.setMode(mode as PeriodMode);
  }

  protected label(): string {
    return periodLabel(this.store.mode(), this.store.range());
  }
}
