import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Badge } from '@shared/ui/badge/badge';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { ActivityEvent } from '../../models/activity';
import {
  BoardCard,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JobSummary,
  STAGE_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from '../../models/execution';

export type PanelTab = 'detail' | 'activity' | 'logs';

/**
 * El panel lateral de un ticket (o del «registro general»): su detalle, su historia y el registro de
 * lo que hizo cada trabajador. Sin ticket solo muestra el registro.
 */
@Component({
  selector: 'app-ticket-panel',
  imports: [TimeAgoPipe, Alert, Avatar, Badge, Icon, IconButton, MarkdownViewer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismissed.emit()' },
  templateUrl: './ticket-panel.html',
  styleUrl: './ticket-panel.scss',
})
export class TicketPanel {
  /** El ticket abierto; `null` = registro general. */
  readonly card = input<BoardCard | null>(null);
  readonly title = input.required<string>();
  readonly branch = input('');
  /** Los trabajos que se pueden ver en el registro. */
  readonly jobs = input.required<readonly JobSummary[]>();
  readonly events = input<readonly ActivityEvent[]>([]);
  readonly logs = input('');
  readonly selectedJobId = input<string | null>(null);
  /** Cómo se muestra el agente que hizo un trabajo. */
  readonly workerName = input<(job: JobSummary) => string>(() => '');

  readonly dismissed = output();
  readonly selectJob = output<string>();

  private readonly picked = signal<PanelTab | null>(null);
  /** Sin ticket no hay detalle ni historia: solo el registro. */
  protected readonly tab = computed<PanelTab>(() =>
    this.card() ? (this.picked() ?? 'detail') : 'logs',
  );
  protected readonly tabs = computed<{ id: PanelTab; label: string }[]>(() =>
    this.card()
      ? [
          { id: 'detail', label: 'Detalle' },
          { id: 'activity', label: 'Actividad' },
          { id: 'logs', label: 'Registro' },
        ]
      : [{ id: 'logs', label: 'Registro' }],
  );

  protected readonly selectedJob = computed(
    () => this.jobs().find((job) => job.id === this.selectedJobId()) ?? null,
  );

  protected readonly statusLabel = TICKET_STATUS_LABEL;
  protected readonly statusTone = TICKET_STATUS_TONE;
  protected readonly jobStatusLabel = JOB_STATUS_LABEL;
  protected readonly jobStatusTone = JOB_STATUS_TONE;

  protected pick(tab: PanelTab): void {
    this.picked.set(tab);
  }

  /** Una lista de textos como lista de Markdown (los criterios y las correcciones traen formato). */
  protected list(items: readonly string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
  }

  /** Las rutas, en código para que los guiones bajos no se lean como énfasis. */
  protected paths(files: readonly string[] | undefined): string {
    return this.list((files ?? []).map((file) => `\`${file}\``));
  }

  /** «Desarrollo · David (intento 2)». */
  protected jobLabel(job: JobSummary): string {
    const who = this.workerName()(job);
    const retry = job.attempt > 1 ? ` (intento ${job.attempt})` : '';
    return `${STAGE_LABEL[job.kind]}${who ? ` · ${who}` : ''}${retry}`;
  }
}
