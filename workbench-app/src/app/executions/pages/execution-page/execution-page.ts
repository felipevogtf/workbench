import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgentsStore, agentLabel } from '@ai-agents/index';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { IconName } from '@shared/ui/icon/icons';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Spinner } from '@shared/ui/spinner/spinner';
import { ExecutionChat } from '../../components/execution-chat/execution-chat';
import { TicketAssignment } from '../../components/ticket-assignment/ticket-assignment';
import { TicketQuestions } from '../../components/ticket-questions/ticket-questions';
import { TicketBoard } from '../../components/ticket-board/ticket-board';
import { TicketPanel } from '../../components/ticket-panel/ticket-panel';
import { ExecutionChatStore } from '../../data-access/execution-chat.store';
import { ExecutionStore } from '../../data-access/execution.store';
import { activityOf } from '../../models/activity';
import { describeUsage } from '../../models/usage';
import {
  BoardCard,
  EXECUTION_STATUS_LABEL,
  EXECUTION_STATUS_TONE,
  ExecutionDetail,
  JobSummary,
  STAGE_LABEL,
  StageStatus,
  Worker,
  executionProgress,
} from '../../models/execution';

const STAGE_ICON: Record<StageStatus, IconName | null> = {
  pending: 'circle-dot',
  running: null,
  done: 'check',
  failed: 'x',
};

/** Lo que se abre en el panel cuando no es un ticket: el registro de crear los tickets y de subir la rama. */
const GENERAL = 'general';

/**
 * Una ejecución de tarea como un tablero de tickets: cada tarjeta muestra qué trabajador la tiene, y
 * al abrirla se ve su detalle, su historia y lo que hizo cada trabajador. Se actualiza sola mientras
 * está en marcha.
 */
@Component({
  selector: 'app-execution-page',
  imports: [
    RouterLink,
    Alert,
    Badge,
    Button,
    Icon,
    PageHeader,
    Skeleton,
    Spinner,
    ExecutionChat,
    TicketAssignment,
    TicketQuestions,
    TicketBoard,
    TicketPanel,
  ],
  providers: [ExecutionStore, ExecutionChatStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './execution-page.html',
  styleUrl: './execution-page.scss',
})
export class ExecutionPage {
  /** Viene de la ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly store = inject(ExecutionStore);
  private readonly agents = inject(AgentsStore);
  private readonly confirm = inject(ConfirmDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabel = EXECUTION_STATUS_LABEL;
  protected readonly statusTone = EXECUTION_STATUS_TONE;
  protected readonly stageLabel = STAGE_LABEL;
  protected readonly stageIcon = STAGE_ICON;

  /** El ticket abierto en el panel (su id), o `general`; `null` = panel cerrado. */
  protected readonly openId = signal<string | null>(null);

  /** Cómo se muestra un agente; sin conocerlo, un nombre genérico. */
  protected readonly workerName = (job: JobSummary): string =>
    this.workerOf(job)?.name ?? 'Un trabajador';

  /** Las tarjetas del tablero: cada ticket con quién lo tiene ahora. */
  protected readonly cards = computed<BoardCard[]>(() => {
    const detail = this.store.detail();
    if (!detail) return [];
    const defaultDeveloper = this.agents.defaultAgentOf('task-developer');

    return detail.tickets.map((ticket, index) => {
      const mine = detail.jobs.filter((job) => job.ticketId === ticket.id);
      const last = (kind: 'develop' | 'review') => mine.filter((job) => job.kind === kind).at(-1);
      const job =
        ticket.status === 'developing'
          ? last('develop')
          : ticket.status === 'reviewing' || ticket.status === 'done'
            ? last('review')
            : ticket.status === 'failed'
              ? mine.at(-1)
              : undefined;

      let worker = job ? this.workerOf(job) : null;
      let upcoming = false;
      // Un ticket que espera su turno es del desarrollador de ahora, que lo tomará.
      if (!worker && ticket.status === 'pending') {
        const developer =
          this.agents.agents().find((agent) => agent.id === ticket.developerId) ?? defaultDeveloper;
        if (developer) {
          worker = { name: agentLabel(developer), avatar: developer.avatar ?? null };
          upcoming = true;
        }
      }
      // Con varios repositorios, cada tarjeta dice en cuál se desarrolla.
      const repo =
        detail.repos.length > 1 ? (ticket.repo ?? detail.repo.fullName).split('/').pop() : null;
      return { ticket, number: index + 1, worker, repo, upcoming };
    });
  });

  /** Quiénes pueden desarrollar y revisar, para repartir los tickets antes de empezar. */
  protected readonly developers = computed(() =>
    this.agents
      .agents()
      .filter((agent) => agent.module === 'task-developer' && agent.provider === 'claude'),
  );
  protected readonly reviewers = computed(() =>
    this.agents
      .agents()
      .filter((agent) => agent.module === 'task-reviewer' && agent.provider === 'claude'),
  );

  /** Las tarjetas con una pregunta de un desarrollador que espera respuesta. */
  protected readonly questions = computed(() =>
    this.cards().filter((card) => !!card.ticket.question),
  );

  /** Lucy, quien escala las preguntas, con el nombre y la imagen con que se ve en la app. */
  protected readonly lucy = computed(() => this.agents.assistantOf('task-tickets'));

  /** Lo que el chat de Lucy necesita saber para avisar de una pregunta nueva. */
  /** Las dudas que dejaron los agentes al avanzar: Lucy las comenta en su chat. */
  protected readonly chatDoubts = computed(() =>
    this.cards().flatMap((card) =>
      (card.ticket.doubts ?? []).map((doubt) => ({
        id: doubt.id,
        from: doubt.from,
        ticket: card.number,
        text: doubt.text,
      })),
    ),
  );

  protected readonly chatQuestions = computed(() =>
    this.questions().flatMap((card) =>
      card.ticket.question
        ? [
            {
              id: card.ticket.question.id,
              from: card.ticket.question.from,
              ticket: card.number,
              text: card.ticket.question.text,
            },
          ]
        : [],
    ),
  );

  /** Lo que gastó la ejecución, para la franja de resumen. */
  protected readonly consumption = computed(() => describeUsage(this.store.detail()?.usage));

  protected readonly progress = computed(() => {
    const tickets = this.store.detail()?.tickets ?? [];
    const done = tickets.filter((ticket) => ticket.status === 'done').length;
    return {
      done,
      total: tickets.length,
      percent: tickets.length ? Math.round((done / tickets.length) * 100) : 0,
    };
  });

  /** El ticket abierto, o `null` si está cerrado o es el registro general. */
  protected readonly panelCard = computed(
    () => this.cards().find((card) => card.ticket.id === this.openId()) ?? null,
  );

  /** Los trabajos que muestra el panel: los del ticket o, en el general, los que no son de un ticket. */
  protected readonly panelJobs = computed(() => {
    const jobs = this.store.detail()?.jobs ?? [];
    return this.openId() === GENERAL
      ? jobs.filter((job) => job.kind === 'tickets' || job.kind === 'publish')
      : jobs.filter((job) => job.ticketId === this.openId());
  });

  protected readonly panelEvents = computed(() => {
    if (!this.panelCard()) return [];
    const jobs = this.store.detail()?.jobs ?? [];
    return activityOf(
      [...jobs.filter((job) => job.kind === 'tickets'), ...this.panelJobs()],
      this.workerName,
    );
  });

  protected readonly panelTitle = computed(
    () => this.panelCard()?.ticket.title ?? 'Registro general',
  );

  constructor() {
    void this.agents.load();

    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id, this.destroyRef));
    });
  }

  /** Dónde va la ejecución, en una frase. */
  protected activity(execution: ExecutionDetail): string {
    switch (execution.status) {
      case 'running':
        return executionProgress(execution) ?? '';
      case 'awaiting':
        return 'Los tickets están listos. Revisa quién hace cada uno y pulsa Empezar.';
      case 'completed':
        return 'Todos los tickets están hechos y la pull request está abierta.';
      case 'failed':
        return 'Se detuvo. Puedes reintentar desde donde quedó.';
      case 'cancelled':
        return 'Se canceló antes de terminar.';
    }
  }

  protected open(id: string): void {
    this.openId.set(id);
    const last = this.panelJobs().at(-1);
    if (last) void this.store.selectJob(last.id);
  }

  protected openGeneral(): void {
    this.open(GENERAL);
  }

  protected closePanel(): void {
    this.openId.set(null);
  }

  protected pickJob(jobId: string): void {
    void this.store.selectJob(jobId);
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

  /** Una nota del usuario para quien trabaje el ticket abierto. */
  protected leaveNote(text: string): void {
    const ticketId = this.panelCard()?.ticket.id;
    if (ticketId) void this.store.addNote(ticketId, text);
  }

  protected answer(reply: { ticketId: string; text: string }): void {
    void this.store.answer(reply.ticketId, reply.text);
  }

  protected begin(): void {
    void this.store.begin();
  }

  protected assign(change: { ticketId: string; developerId?: string; reviewerId?: string }): void {
    void this.store.assign(change.ticketId, change);
  }

  protected retry(): void {
    void this.store.retry();
  }

  /** El trabajador que hizo un trabajo: por su id y, en los trabajos viejos, por su nombre técnico. */
  private workerOf(job: JobSummary): Worker | null {
    const agent = this.agents
      .agents()
      .find(
        (candidate) =>
          (job.agentId !== null && candidate.id === job.agentId) ||
          (job.agentId === null && job.agentName !== null && candidate.name === job.agentName),
      );
    return agent ? { name: agentLabel(agent), avatar: agent.avatar ?? null } : null;
  }
}
