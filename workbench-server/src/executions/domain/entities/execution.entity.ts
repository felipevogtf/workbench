import { DomainError } from '@core/domain/domain.error';
import {
  ExecutionExtraRepo,
  ExecutionProps,
  ExecutionRepo,
  ExecutionStatus,
  ExecutionTarget,
  ExecutionTicket,
  STAGE_KEYS,
  StageKey,
  StageStatus,
} from './execution.props';

export class Execution {
  private constructor(private props: ExecutionProps) {}

  static create(data: {
    id?: string;
    issueId: string;
    planId: string;
    repo: ExecutionRepo;
    branch: string;
    /** Los demás repositorios de la tarea, ya con su rama. */
    extraRepos?: { repo: ExecutionRepo; branch: string }[];
  }): Execution {
    const now = new Date();
    return new Execution({
      id: data.id ?? crypto.randomUUID(),
      issueId: data.issueId,
      planId: data.planId,
      repo: data.repo,
      branch: data.branch,
      baseBranch: null,
      extraRepos: (data.extraRepos ?? []).map((extra): ExecutionExtraRepo => ({
        ...extra,
        baseBranch: null,
        pullRequestUrl: null,
      })),
      status: 'running',
      stages: STAGE_KEYS.map((key) => ({
        key,
        status: 'pending',
        startedAt: null,
        finishedAt: null,
      })),
      tickets: [],
      pullRequestUrl: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    });
  }

  static reconstruct(props: ExecutionProps): Execution {
    // Los tickets de antes de los niveles no traían estos datos.
    props.extraRepos ??= [];
    for (const ticket of props.tickets) {
      ticket.level ??= 'medium';
      ticket.developerId ??= null;
      ticket.reviewerId ??= null;
    }
    return new Execution(props);
  }

  get id(): string {
    return this.props.id;
  }
  get issueId(): string {
    return this.props.issueId;
  }
  get planId(): string {
    return this.props.planId;
  }
  get repo(): ExecutionRepo {
    return this.props.repo;
  }
  get branch(): string {
    return this.props.branch;
  }
  get baseBranch(): string | null {
    return this.props.baseBranch;
  }
  get extraRepos(): ExecutionExtraRepo[] {
    return this.props.extraRepos;
  }
  get status(): ExecutionStatus {
    return this.props.status;
  }
  get stages() {
    return this.props.stages;
  }
  get tickets(): ExecutionTicket[] {
    return this.props.tickets;
  }
  get pullRequestUrl(): string | null {
    return this.props.pullRequestUrl;
  }
  get error(): string | null {
    return this.props.error;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }

  get isActive(): boolean {
    return this.props.status === 'running' || this.props.status === 'awaiting';
  }

  toProps(): ExecutionProps {
    return this.props;
  }

  ticket(id: string | null): ExecutionTicket {
    const ticket = this.props.tickets.find((candidate) => candidate.id === id);
    if (!ticket) {
      throw DomainError.notFound(`Ticket ${id} not found in the execution`);
    }
    return ticket;
  }

  /** Todos los repositorios de la ejecución, el primero antes. */
  targets(): ExecutionTarget[] {
    return [
      {
        primary: true,
        repo: this.props.repo,
        branch: this.props.branch,
        baseBranch: this.props.baseBranch,
        pullRequestUrl: this.props.pullRequestUrl,
      },
      ...this.props.extraRepos.map((extra) => ({ ...extra, primary: false })),
    ];
  }

  /** El repositorio de un nombre `organización/repo`; sin nombre (o desconocido), el primero. */
  targetOf(fullName?: string | null): ExecutionTarget {
    const targets = this.targets();
    return (
      targets.find((target) => target.repo.fullName === fullName) ?? targets[0]
    );
  }

  /** Rama destino y PR de un repositorio, a medida que se suben y se abren. */
  setTargetBaseBranch(fullName: string, baseBranch: string): void {
    const extra = this.props.extraRepos.find(
      (candidate) => candidate.repo.fullName === fullName,
    );
    if (extra) extra.baseBranch = baseBranch;
    else this.props.baseBranch = baseBranch;
    this.touch();
  }

  setTargetPullRequest(fullName: string, url: string): void {
    const extra = this.props.extraRepos.find(
      (candidate) => candidate.repo.fullName === fullName,
    );
    if (extra) extra.pullRequestUrl = url;
    else this.props.pullRequestUrl = url;
    this.touch();
  }

  /** El siguiente ticket por desarrollar, en el orden en que los creó el agente. */
  nextPendingTicket(): ExecutionTicket | null {
    return (
      this.props.tickets.find((ticket) => ticket.status === 'pending') ?? null
    );
  }

  setTickets(tickets: ExecutionTicket[]): void {
    this.props.tickets = tickets;
    this.touch();
  }

  /** Los tickets están listos: se espera el visto bueno del usuario antes de desarrollarlos. */
  awaitStart(): void {
    this.props.status = 'awaiting';
    this.touch();
  }

  /** El usuario dio el visto bueno: empieza el desarrollo. */
  begin(): void {
    if (this.props.status !== 'awaiting') {
      throw DomainError.conflict('The execution is not waiting to start');
    }
    this.props.status = 'running';
    this.touch();
  }

  setBaseBranch(baseBranch: string): void {
    this.props.baseBranch = baseBranch;
    this.touch();
  }

  setStage(key: StageKey, status: StageStatus): void {
    const stage = this.props.stages.find((candidate) => candidate.key === key);
    if (!stage) return;

    const now = new Date().toISOString();
    if (status === 'running' && !stage.startedAt) stage.startedAt = now;
    stage.finishedAt = status === 'done' || status === 'failed' ? now : null;
    stage.status = status;
    this.touch();
  }

  complete(pullRequestUrl: string): void {
    this.props.status = 'completed';
    this.props.pullRequestUrl = pullRequestUrl;
    this.props.error = null;
    this.props.finishedAt = new Date();
    this.touch();
  }

  fail(message: string): void {
    this.props.status = 'failed';
    this.props.error = message.slice(0, 2000);
    this.props.finishedAt = new Date();
    // Nada sigue en marcha: una etapa que quedara «corriendo» giraría para siempre en la pantalla.
    for (const stage of this.props.stages) {
      if (stage.status === 'running') stage.status = 'pending';
    }
    this.touch();
  }

  cancel(): void {
    this.props.status = 'cancelled';
    this.props.finishedAt = new Date();
    for (const stage of this.props.stages) {
      if (stage.status === 'running') stage.status = 'pending';
    }
    this.touch();
  }

  /** Vuelve a correr tras un fallo. */
  resume(): void {
    if (this.props.status !== 'failed') {
      throw DomainError.conflict('Only a failed execution can be retried');
    }
    this.props.status = 'running';
    this.props.error = null;
    this.props.finishedAt = null;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
