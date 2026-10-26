import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Spinner } from '@shared/ui/spinner/spinner';
import { ExecutionHistoryStore } from '../../data-access/execution-history.store';
import {
  EXECUTION_STATUS_LABEL,
  EXECUTION_STATUS_TONE,
  ExecutionListItem,
  executionProgress,
} from '../../models/execution';

/** Todas las ejecuciones: lo que la IA está haciendo ahora y lo que ya hizo, de todas las tareas. */
@Component({
  selector: 'app-executions-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TimeAgoPipe,
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    Icon,
    PageHeader,
    Skeleton,
    Spinner,
  ],
  providers: [ExecutionHistoryStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './executions-page.html',
  styleUrl: './executions-page.scss',
})
export class ExecutionsPage {
  protected readonly store = inject(ExecutionHistoryStore);

  protected readonly progress = executionProgress;

  constructor() {
    void this.store.load(inject(DestroyRef));
  }

  protected reload(): void {
    void this.store.load();
  }

  protected label(execution: ExecutionListItem): string {
    return EXECUTION_STATUS_LABEL[execution.status];
  }

  protected tone(execution: ExecutionListItem): BadgeTone {
    return EXECUTION_STATUS_TONE[execution.status];
  }

  /** Cuántos tickets de la ejecución ya están hechos. */
  protected done(execution: ExecutionListItem): number {
    return execution.tickets.filter((ticket) => ticket.status === 'done').length;
  }
}
