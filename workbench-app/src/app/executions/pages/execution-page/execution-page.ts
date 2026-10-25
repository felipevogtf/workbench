import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { IconName } from '@shared/ui/icon/icons';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Spinner } from '@shared/ui/spinner/spinner';
import { ExecutionStore } from '../../data-access/execution.store';
import {
  EXECUTION_STATUS_LABEL,
  EXECUTION_STATUS_TONE,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JobSummary,
  STAGE_HINT,
  STAGE_LABEL,
  StageStatus,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from '../../models/execution';

const STAGE_ICON: Record<StageStatus, IconName | null> = {
  pending: 'circle-dot',
  running: null,
  done: 'check',
  failed: 'x',
};

/**
 * Una ejecución de tarea: en qué etapa va, sus tickets y lo que hace cada agente (registro en vivo).
 * Se actualiza sola mientras está en marcha.
 */
@Component({
  selector: 'app-execution-page',
  imports: [
    RouterLink,
    TimeAgoPipe,
    Alert,
    Badge,
    Button,
    Card,
    Icon,
    MarkdownViewer,
    PageHeader,
    Skeleton,
    Spinner,
  ],
  providers: [ExecutionStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './execution-page.html',
  styleUrl: './execution-page.scss',
})
export class ExecutionPage {
  /** Viene de la ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly store = inject(ExecutionStore);
  private readonly confirm = inject(ConfirmDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabel = EXECUTION_STATUS_LABEL;
  protected readonly statusTone = EXECUTION_STATUS_TONE;
  protected readonly stageLabel = STAGE_LABEL;
  protected readonly stageHint = STAGE_HINT;
  protected readonly stageIcon = STAGE_ICON;
  protected readonly ticketLabel = TICKET_STATUS_LABEL;
  protected readonly ticketTone = TICKET_STATUS_TONE;
  protected readonly jobLabel = JOB_STATUS_LABEL;
  protected readonly jobTone = JOB_STATUS_TONE;

  /** Nombres de los tickets por id, para rotular los trabajos. */
  private readonly ticketTitles = computed(
    () => new Map(this.store.detail()?.tickets.map((ticket) => [ticket.id, ticket.title]) ?? []),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id, this.destroyRef));
    });
  }

  /** «Desarrollo · API de órdenes (intento 2)». */
  protected jobTitle(job: JobSummary): string {
    const stage = STAGE_LABEL[job.kind];
    const ticket = job.ticketId ? this.ticketTitles().get(job.ticketId) : null;
    const retry = job.attempt > 1 ? ` (intento ${job.attempt})` : '';
    return `${stage}${ticket ? ` · ${ticket}` : ''}${retry}`;
  }

  /** Una lista de textos como lista de Markdown (los criterios y las correcciones traen formato). */
  protected list(items: readonly string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
  }

  protected async cancel(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Cancelar la ejecución',
      message:
        'Se detiene el trabajo que esté en curso en el runner. Lo que ya se hizo en la rama se conserva en tu PC.',
      confirmLabel: 'Cancelar la ejecución',
      tone: 'danger',
    });
    if (confirmed) await this.store.cancel();
  }

  protected retry(): void {
    void this.store.retry();
  }

  protected select(job: JobSummary): void {
    void this.store.selectJob(job.id);
  }
}
