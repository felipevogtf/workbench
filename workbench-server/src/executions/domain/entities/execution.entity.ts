import { DomainError } from '@core/domain/domain.error';
import {
  ChangeAuthor,
  EditableTicketFields,
  ExecutionExtraRepo,
  ExecutionProps,
  ExecutionRepo,
  ExecutionStatus,
  ExecutionTarget,
  ExecutionTicket,
  FinalReview,
  FinalReviewFinding,
  STAGE_KEYS,
  StageKey,
  StageStatus,
  TICKET_LEVELS,
  TicketChange,
  TicketChangeKind,
} from './execution.props';

/** Cuántos tickets eliminados se guardan para poder restaurarlos. */
const MAX_REMOVED = 30;
/** Cuántos cambios se recuerdan. */
const MAX_CHANGES = 200;

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
    openPullRequest?: boolean;
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
      status: 'draft',
      stages: STAGE_KEYS.map((key) => ({
        key,
        status: 'pending',
        startedAt: null,
        finishedAt: null,
      })),
      tickets: [],
      pullRequestUrl: null,
      openPullRequest: data.openPullRequest ?? true,
      error: null,
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    });
  }

  static reconstruct(props: ExecutionProps): Execution {
    // Los tickets de antes de los niveles no traían estos datos.
    props.extraRepos ??= [];
    props.finalReview ??= null;
    for (const ticket of props.tickets) {
      ticket.level ??= 'medium';
      ticket.developerId ??= null;
      ticket.reviewerId ??= null;
      ticket.question ??= null;
      ticket.decisions ??= [];
      ticket.questionsAsked ??= 0;
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
  get opensPullRequest(): boolean {
    return this.props.openPullRequest ?? true;
  }

  get pullRequestUrl(): string | null {
    return this.props.pullRequestUrl;
  }
  get error(): string | null {
    return this.props.error;
  }
  get finalReview(): FinalReview | null {
    return this.props.finalReview ?? null;
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
    return this.props.status === 'running' || this.props.status === 'draft';
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

  /** Suma un repositorio a los de la ejecución, con la misma rama; la rama base y la PR llegan al publicar. */
  addRepo(repo: ExecutionRepo): void {
    if (this.targets().some((t) => t.repo.fullName === repo.fullName)) {
      throw DomainError.conflict(
        `${repo.fullName} is already part of the execution`,
      );
    }
    this.props.extraRepos.push({
      repo,
      branch: this.props.branch,
      baseBranch: null,
      pullRequestUrl: null,
    });
    this.touch();
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

  /** Los cambios a los tickets del borrador, del más antiguo al más nuevo. */
  get changes(): TicketChange[] {
    return this.props.history?.changes ?? [];
  }

  /** Los tickets eliminados del borrador, que se pueden restaurar deshaciendo su cambio. */
  get removedTickets(): ExecutionTicket[] {
    return this.props.history?.removed ?? [];
  }

  /**
   * Los tickets del borrador solo se tocan con la ejecución en borrador y una vez que Lucy los creó (antes, el trabajo que los crea
   * los reemplazaría), y solo los que siguen pendientes: uno que ya empezó o terminó no se cambia.
   */
  private assertEditable(ticket?: ExecutionTicket): void {
    if (this.props.status !== 'draft') {
      throw DomainError.conflict(
        'Tickets can only be changed while the execution is a draft',
      );
    }
    if (
      this.props.stages.find((stage) => stage.key === 'tickets')?.status !==
      'done'
    ) {
      throw DomainError.conflict('The tickets are not ready yet');
    }
    if (ticket && ticket.status !== 'pending') {
      throw DomainError.conflict(
        `The ticket "${ticket.title}" is no longer pending`,
      );
    }
  }

  private record(change: {
    by: ChangeAuthor;
    kind: TicketChangeKind;
    ticket: ExecutionTicket;
    summary: string;
    before?: Partial<EditableTicketFields> | null;
    index?: number;
    noteAt?: string;
  }): TicketChange {
    const entry: TicketChange = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      by: change.by,
      kind: change.kind,
      ticketId: change.ticket.id,
      title: change.ticket.title,
      summary: change.summary,
      before: change.before ?? null,
      ...(change.index !== undefined ? { index: change.index } : {}),
      ...(change.noteAt ? { noteAt: change.noteAt } : {}),
      undone: false,
    };
    const history = this.props.history ?? { changes: [], removed: [] };
    this.props.history = {
      changes: [...history.changes, entry].slice(-MAX_CHANGES),
      removed: history.removed,
    };
    this.touch();
    return entry;
  }

  /** Suma un ticket nuevo al final del borrador. */
  createTicket(ticket: ExecutionTicket, by: ChangeAuthor): TicketChange {
    this.assertEditable();
    this.props.tickets = [...this.props.tickets, ticket];
    return this.record({
      by,
      kind: 'create',
      ticket,
      summary: `Creé el ticket «${ticket.title}»`,
    });
  }

  /** Cambia el título, la descripción, los criterios, el nivel o el repo de un ticket pendiente. */
  updateTicket(
    id: string,
    changes: Partial<
      Pick<
        ExecutionTicket,
        'title' | 'description' | 'criteria' | 'level' | 'repo'
      >
    >,
    by: ChangeAuthor,
  ): TicketChange {
    const ticket = this.ticket(id);
    this.assertEditable(ticket);
    if (changes.level !== undefined && !TICKET_LEVELS.includes(changes.level)) {
      throw new DomainError('The level must be simple, medium or complex');
    }
    if (changes.title !== undefined && !changes.title.trim()) {
      throw new DomainError('The title cannot be empty');
    }
    if (changes.description !== undefined && !changes.description.trim()) {
      throw new DomainError('The description cannot be empty');
    }

    const before: Partial<EditableTicketFields> = {};
    const fields = Object.keys(changes) as (keyof typeof changes)[];
    for (const field of fields) {
      const next = changes[field];
      if (
        next === undefined ||
        JSON.stringify(ticket[field]) === JSON.stringify(next)
      )
        continue;
      (before as Record<string, unknown>)[field] = ticket[field];
      (ticket as unknown as Record<string, unknown>)[field] = next;
    }
    const touched = Object.keys(before);
    if (touched.length === 0)
      throw new DomainError('That change leaves the ticket as it was');
    return this.record({
      by,
      kind: 'update',
      ticket,
      before,
      summary: `Modifiqué ${touched.map((field) => FIELD_LABEL[field] ?? field).join(', ')} del ticket «${ticket.title}»`,
    });
  }

  /** Quita un ticket pendiente del borrador. No se borra: queda guardado y deshacer el cambio lo restaura. */
  removeTicket(id: string, by: ChangeAuthor): TicketChange {
    const ticket = this.ticket(id);
    this.assertEditable(ticket);
    const index = this.props.tickets.indexOf(ticket);
    this.props.tickets = this.props.tickets.filter((each) => each !== ticket);
    const entry = this.record({
      by,
      kind: 'remove',
      ticket,
      index,
      summary: `Eliminé el ticket «${ticket.title}»`,
    });
    const history = this.props.history as NonNullable<
      ExecutionProps['history']
    >;
    this.props.history = {
      ...history,
      removed: [...history.removed, ticket].slice(-MAX_REMOVED),
    };
    return entry;
  }

  /** Cambia quién desarrolla o revisa un ticket pendiente. */
  assignTicket(
    id: string,
    who: { developerId?: string; reviewerId?: string },
    by: ChangeAuthor,
    names: { developer?: string; reviewer?: string } = {},
  ): TicketChange {
    const ticket = this.ticket(id);
    this.assertEditable(ticket);
    const before: Partial<EditableTicketFields> = {};
    const said: string[] = [];
    if (who.developerId && who.developerId !== ticket.developerId) {
      before.developerId = ticket.developerId;
      ticket.developerId = who.developerId;
      said.push(`desarrolla ${names.developer ?? 'otro agente'}`);
    }
    if (who.reviewerId && who.reviewerId !== ticket.reviewerId) {
      before.reviewerId = ticket.reviewerId;
      ticket.reviewerId = who.reviewerId;
      said.push(`revisa ${names.reviewer ?? 'otro agente'}`);
    }
    if (said.length === 0)
      throw new DomainError('That worker already has the ticket');
    return this.record({
      by,
      kind: 'assign',
      ticket,
      before,
      summary: `Reasigné el ticket «${ticket.title}»: ${said.join(' y ')}`,
    });
  }

  /** Deja una nota para el agente del ticket (en el borrador se guarda sin confirmar). */
  leaveNote(id: string, text: string, by: ChangeAuthor): TicketChange {
    const ticket = this.ticket(id);
    this.assertEditable(ticket);
    const note = text.trim();
    if (!note) throw new DomainError('The note cannot be empty');
    const at = new Date().toISOString();
    ticket.notes = [...(ticket.notes ?? []), { at, from: by, text: note }];
    return this.record({
      by,
      kind: 'note',
      ticket,
      noteAt: at,
      summary: `Dejé una nota en el ticket «${ticket.title}»`,
    });
  }

  /** Deshace un cambio del historial: devuelve el ticket a como estaba. Solo en el borrador y sobre tickets que siguen pendientes. */
  undo(changeId: string): TicketChange {
    const change = this.changes.find((each) => each.id === changeId);
    if (!change) throw DomainError.notFound(`Change ${changeId} not found`);
    if (change.undone)
      throw DomainError.conflict('That change was already undone');
    this.assertEditable();

    if (change.kind === 'remove') {
      const history = this.props.history as NonNullable<
        ExecutionProps['history']
      >;
      const ticket = history.removed.find(
        (each) => each.id === change.ticketId,
      );
      if (!ticket)
        throw DomainError.notFound('The removed ticket is no longer stored');
      const at = Math.min(
        change.index ?? this.props.tickets.length,
        this.props.tickets.length,
      );
      this.props.tickets = [
        ...this.props.tickets.slice(0, at),
        ticket,
        ...this.props.tickets.slice(at),
      ];
      this.props.history = {
        ...history,
        removed: history.removed.filter((each) => each !== ticket),
      };
    } else {
      const ticket = this.ticket(change.ticketId);
      this.assertEditable(ticket);
      if (change.kind === 'create') {
        this.props.tickets = this.props.tickets.filter(
          (each) => each !== ticket,
        );
      } else if (change.kind === 'note') {
        ticket.notes = (ticket.notes ?? []).filter(
          (note) => note.at !== change.noteAt,
        );
      } else {
        Object.assign(ticket, change.before ?? {});
        // Un campo opcional que antes no existía vuelve a no existir.
        for (const field of Object.keys(
          change.before ?? {},
        ) as (keyof EditableTicketFields)[]) {
          if (ticket[field] === undefined) delete ticket[field];
        }
      }
    }
    change.undone = true;
    this.touch();
    return change;
  }

  /** Es un borrador: nada corre todavía y se pueden ajustar los tickets. */
  get isDraft(): boolean {
    return this.props.status === 'draft';
  }

  /**
   * El play: el borrador empieza a desarrollarse. Pide que Lucy haya terminado de crear los tickets y que haya alguno por hacer.
   */
  begin(): void {
    if (this.props.status !== 'draft') {
      throw DomainError.conflict('Only a draft can be played');
    }
    const ticketsStage = this.props.stages.find(
      (stage) => stage.key === 'tickets',
    );
    if (ticketsStage?.status !== 'done') {
      throw DomainError.conflict('The tickets are not ready yet');
    }
    if (!this.nextPendingTicket()) {
      throw DomainError.conflict('There are no tickets to run');
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

  complete(pullRequestUrl: string | null): void {
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

  /**
   * Una ejecución terminada vuelve a correr para corregir un ticket o sumar otros: la PR ya está abierta y la rama
   * subida, así que lo que sigue se publica sobre la misma rama.
   */
  reopen(): void {
    if (this.props.status !== 'completed') {
      throw DomainError.conflict('Only a completed execution can be reopened');
    }
    this.props.status = 'running';
    this.props.error = null;
    this.props.finishedAt = null;
    this.setStage('publish', 'pending');
  }

  /** Suma tickets a una ejecución que ya tiene los suyos. */
  addTickets(tickets: ExecutionTicket[]): void {
    this.props.tickets = [...this.props.tickets, ...tickets];
    this.touch();
  }

  /** El usuario pidió la revisión final: solo con la ejecución terminada y de una en una. */
  startFinalReview(): void {
    if (this.props.status !== 'completed') {
      throw DomainError.conflict(
        'The final review can only be requested once the execution is completed',
      );
    }
    if (this.props.finalReview?.status === 'running') {
      throw DomainError.conflict('The final review is already running');
    }
    this.props.finalReview = {
      status: 'running',
      requestedAt: new Date().toISOString(),
      finishedAt: null,
      summary: null,
      findings: [],
      error: null,
    };
    this.touch();
  }

  finishFinalReview(report: {
    summary: string;
    findings: FinalReviewFinding[];
  }): void {
    const current = this.props.finalReview;
    if (!current) return;
    this.props.finalReview = {
      ...current,
      status: 'done',
      finishedAt: new Date().toISOString(),
      summary: report.summary || null,
      findings: report.findings,
      error: null,
    };
    this.touch();
  }

  failFinalReview(message: string): void {
    const current = this.props.finalReview;
    if (!current) return;
    this.props.finalReview = {
      ...current,
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: message.slice(0, 2000),
    };
    this.touch();
  }

  /** Vuelve a correr tras un fallo. */
  resume(): void {
    if (this.props.status !== 'failed') {
      throw DomainError.conflict('Only a failed execution can be retried');
    }
    // Si falló al crear los tickets sigue siendo un borrador; si falló después, el desarrollo ya había empezado.
    const ticketsStage = this.props.stages.find(
      (stage) => stage.key === 'tickets',
    );
    this.props.status = ticketsStage?.status === 'done' ? 'running' : 'draft';
    this.props.error = null;
    this.props.finishedAt = null;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}

const FIELD_LABEL: Record<string, string> = {
  title: 'el título',
  description: 'la descripción',
  criteria: 'los criterios',
  level: 'el nivel',
  repo: 'el repositorio',
};
