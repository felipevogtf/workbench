import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '@core/domain/domain.error';
import { Execution } from '@executions/domain/entities/execution.entity';
import {
  ExecutionTicket,
  StageKey,
} from '@executions/domain/entities/execution.props';
import { Job } from '@executions/domain/entities/job.entity';
import { JobPayload } from '@executions/domain/entities/job.props';
import {
  parseDecision,
  parseDoubts,
  parseQuestion,
  parseReview,
  parseTickets,
} from '@executions/domain/json-output';
import {
  buildDevelopPrompt,
  buildPullRequestDescription,
  buildQuestionPrompt,
  buildReviewPrompt,
  buildTicketsPrompt,
  MAX_REVIEW_ROUNDS,
  MAX_TICKETS,
} from '@executions/domain/prompts';
import { branchNameFor, parseRepo } from '@executions/domain/repo';
import {
  EXECUTION_REPOSITORY_PORT,
  type ExecutionRepositoryPort,
} from '@executions/domain/ports/execution-repository.port';
import {
  JOB_REPOSITORY_PORT,
  type JobRepositoryPort,
} from '@executions/domain/ports/job-repository.port';
import {
  AGENTS_GATEWAY_PORT,
  PLANS_GATEWAY_PORT,
  PULL_REQUESTS_GATEWAY_PORT,
  RECIPES_GATEWAY_PORT,
  TASKS_GATEWAY_PORT,
  type AgentsGatewayPort,
  type ExecutionAgentModule,
  type PlansGatewayPort,
  type PullRequestsGatewayPort,
  type RecipesGatewayPort,
  type ResolvedAgent,
  type TasksGatewayPort,
} from '@executions/domain/ports/gateways.port';

const MAX_SUMMARY_CHARS = 4000;
/** Por ahora las PRs solo se abren en Bitbucket. */
const SUPPORTED_HOST = 'bitbucket.org';
/** Repositorios que puede tocar una misma tarea: cada uno suma una carpeta de trabajo y una PR. */
const MAX_REPOS = 3;
/** Preguntas que un desarrollador puede hacer en un mismo ticket: a la tercera se falla con lo que pasó. */
const MAX_QUESTIONS = 2;
/** Cuántas dudas se guardan por ticket: las más recientes. */
const MAX_DOUBTS = 5;

const AGENT_OF: Record<Exclude<StageKey, 'publish'>, ExecutionAgentModule> = {
  tickets: 'task-tickets',
  develop: 'task-developer',
  review: 'task-reviewer',
};

/**
 * Ejecuta una tarea con agentes: crea los tickets del plan, desarrolla cada uno en una misma rama,
 * lo hace revisar y abre una PR. El servidor solo decide qué sigue; el trabajo lo hace el runner.
 *
 * Es una máquina de estados guiada por eventos: cada trabajo que termina (`handleFinished`) decide
 * el siguiente. No hay bucles ni temporizadores aquí, así que sobrevive a un reinicio del servidor.
 */
@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);

  constructor(
    @Inject(EXECUTION_REPOSITORY_PORT)
    private readonly executions: ExecutionRepositoryPort,
    @Inject(JOB_REPOSITORY_PORT)
    private readonly jobs: JobRepositoryPort,
    @Inject(TASKS_GATEWAY_PORT)
    private readonly tasks: TasksGatewayPort,
    @Inject(PLANS_GATEWAY_PORT)
    private readonly plans: PlansGatewayPort,
    @Inject(AGENTS_GATEWAY_PORT)
    private readonly agents: AgentsGatewayPort,
    @Inject(PULL_REQUESTS_GATEWAY_PORT)
    private readonly pullRequests: PullRequestsGatewayPort,
    @Optional() private readonly config?: ConfigService,
    @Optional()
    @Inject(RECIPES_GATEWAY_PORT)
    private readonly recipes?: RecipesGatewayPort,
  ) {}

  /** Preguntas recién escaladas: Lucy las decide en segundo plano cuando ya se guardó la ejecución. */
  private readonly toDecide = new Map<string, string>();

  /** Empieza a ejecutar la tarea con su último plan. Revisa todo lo que puede fallar antes de encolar. */
  async start(issueId: string): Promise<Execution> {
    const task = await this.tasks.getTask(issueId);
    if (!task) throw DomainError.notFound(`Issue with id ${issueId} not found`);

    if (await this.executions.findActiveByIssueId(issueId)) {
      throw DomainError.conflict('This task is already being executed');
    }

    const plan = await this.plans.getLatestReadyPlan(issueId);
    if (!plan) {
      throw new DomainError('The task needs a ready plan before it can run');
    }

    if (task.repoUrls.length === 0) {
      throw new DomainError(
        'The task has no repository: add a label with a repository link',
      );
    }
    // Un mismo repositorio en dos etiquetas cuenta una vez.
    const repos = [
      ...new Map(
        task.repoUrls.map((url) => {
          const parsed = parseRepo(url);
          return [parsed.fullName, parsed] as const;
        }),
      ).values(),
    ];
    if (repos.length > MAX_REPOS) {
      throw new DomainError(
        `The task has ${repos.length} repositories; a task can run on up to ${MAX_REPOS}`,
      );
    }
    if (repos.some((repo) => repo.host !== SUPPORTED_HOST)) {
      throw new DomainError(
        'For now the pull request can only be opened on Bitbucket',
      );
    }

    // Que no falte ningún agente (ni sea de otro CLI) antes de gastar tiempo en la primera etapa.
    for (const module of Object.values(AGENT_OF)) {
      await this.agents.getDefault(module);
    }

    const id = crypto.randomUUID();
    const branch = branchNameFor(task.name, id);
    const execution = Execution.create({
      id,
      issueId,
      planId: plan.id,
      repo: repos[0],
      branch,
      extraRepos: repos.slice(1).map((repo) => ({ repo, branch })),
    });
    execution.setStage('tickets', 'running');

    const job = await this.buildJob(execution, 'tickets');
    await this.executions.save(execution);
    await this.jobs.save(job);
    return execution;
  }

  /**
   * Las ejecuciones más recientes de todas las tareas (las en curso y el historial), cada una con el
   * nombre de su tarea. Si la tarea ya no existe, el nombre va en `null`.
   */
  async listRecent(
    limit = 100,
  ): Promise<{ execution: Execution; issueName: string | null }[]> {
    const executions = await this.executions.findRecent(limit);

    const names = new Map<string, string | null>();
    for (const issueId of new Set(executions.map((e) => e.issueId))) {
      names.set(issueId, (await this.tasks.getTask(issueId))?.name ?? null);
    }
    return executions.map((execution) => ({
      execution,
      issueName: names.get(execution.issueId) ?? null,
    }));
  }

  listByIssue(issueId: string): Promise<Execution[]> {
    return this.executions.findByIssueId(issueId);
  }

  async get(id: string): Promise<{ execution: Execution; jobs: Job[] }> {
    const execution = await this.executions.findById(id);
    if (!execution) {
      throw DomainError.notFound(`Execution with id ${id} not found`);
    }
    return { execution, jobs: await this.jobs.findByExecutionId(id) };
  }

  async getJob(id: string): Promise<Job> {
    const job = await this.jobs.findById(id);
    if (!job) throw DomainError.notFound(`Job with id ${id} not found`);
    return job;
  }

  /** Detiene la ejecución: lo pendiente se descarta y lo que corre se cancela en el runner. */
  async cancel(id: string): Promise<Execution> {
    const { execution, jobs } = await this.get(id);
    if (!execution.isActive) {
      throw DomainError.conflict('Only a running execution can be cancelled');
    }

    for (const job of jobs.filter((candidate) => candidate.isOpen)) {
      job.cancel();
      await this.jobs.save(job);
    }
    execution.cancel();
    return this.executions.save(execution);
  }

  /** Reintenta lo que falló, sin repetir lo que ya salió bien. */
  async retry(id: string): Promise<Execution> {
    const { execution, jobs } = await this.get(id);
    const last = jobs.at(-1);
    if (!last) throw DomainError.conflict('The execution has nothing to retry');
    execution.resume();

    // La PR falló pero la rama ya está subida: solo se repite la apertura de la PR.
    if (last.kind === 'publish' && last.status === 'done') {
      execution.setStage('publish', 'running');
      await this.executions.save(execution);
      await this.handleFinished(last);
      return (await this.executions.findById(id)) ?? execution;
    }

    const ticket = last.ticketId ? execution.ticket(last.ticketId) : null;
    let next: Job;
    if (ticket?.status === 'failed') {
      // El revisor seguía pidiendo cambios: se da otra vuelta de corrección y una revisión más.
      ticket.status = 'developing';
      ticket.rounds = Math.max(0, MAX_REVIEW_ROUNDS - 1);
      this.refreshStages(execution);
      next = await this.buildJob(execution, 'develop', ticket);
    } else {
      // Se arma de nuevo, no se copia el viejo: así recoge los cambios hechos a los agentes (su prompt y
      // sus herramientas) desde que falló, que suele ser justo lo que se arregló antes de reintentar.
      this.refreshStages(execution);
      next = await this.buildJob(
        execution,
        last.kind,
        ticket ?? undefined,
        last.attempt + 1,
        last.payload.repo.fullName,
      );
    }
    if (next.kind === 'tickets' || next.kind === 'publish') {
      execution.setStage(next.kind, 'running');
    }

    await this.executions.save(execution);
    await this.jobs.save(next);
    return execution;
  }

  /**
   * Un trabajo terminó (bien o mal): decide qué sigue. Nunca lanza por un mal resultado del agente;
   * lo deja como fallo de la ejecución para que el usuario lo vea y pueda reintentar.
   */
  async handleFinished(job: Job): Promise<void> {
    const execution = await this.executions.findById(job.executionId);
    if (!execution?.isActive) return;

    try {
      if (job.status === 'failed') {
        this.fail(execution, job, job.error ?? 'The job failed');
      } else if (job.status === 'done') {
        await this.advance(execution, job);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Execution ${execution.id} stopped: ${message}`);
      this.fail(execution, job, message);
    }
    await this.executions.save(execution);

    const ticketId = this.toDecide.get(execution.id);
    if (ticketId) {
      this.toDecide.delete(execution.id);
      void this.lucyDecides(execution.id, ticketId);
    }
  }

  /**
   * El usuario contesta la pregunta de un desarrollador: queda como decisión del ticket y el desarrollador
   * retoma con ella. También sirve para aceptar lo que recomendó Lucy.
   */
  async answer(
    executionId: string,
    ticketId: string,
    text: string,
  ): Promise<Execution> {
    const execution = await this.executions.findById(executionId);
    if (!execution) {
      throw DomainError.notFound(`Execution with id ${executionId} not found`);
    }
    if (!execution.isActive) {
      throw DomainError.conflict('The execution is not running');
    }
    const ticket = execution.ticket(ticketId);
    if (ticket.status !== 'waiting' || !ticket.question) {
      throw DomainError.conflict('That ticket is not waiting for an answer');
    }
    const answer = text.trim();
    if (!answer) throw new DomainError('The answer cannot be empty');

    await this.resolveQuestion(execution, ticket, 'user', answer);
    return this.executions.save(execution);
  }

  /**
   * El usuario deja una instrucción para quien trabaje el ticket (por ejemplo «no toques los submódulos»).
   * No interrumpe un trabajo en curso: entra al prompt la próxima vez que se desarrolle o revise, incluido un
   * reintento.
   */
  async addNote(
    executionId: string,
    ticketId: string,
    text: string,
  ): Promise<Execution> {
    const execution = await this.executions.findById(executionId);
    if (!execution) {
      throw DomainError.notFound(`Execution with id ${executionId} not found`);
    }
    const ticket = execution.ticket(ticketId);
    if (ticket.status === 'done') {
      throw DomainError.conflict('That ticket is already done');
    }
    const note = text.trim();
    if (!note) throw new DomainError('The note cannot be empty');

    ticket.notes = [
      ...(ticket.notes ?? []),
      { at: new Date().toISOString(), from: 'user', text: note },
    ];
    return this.executions.save(execution);
  }

  /** La respuesta queda como decisión y el desarrollador retoma el ticket con ella. */
  private async resolveQuestion(
    execution: Execution,
    ticket: ExecutionTicket,
    from: 'user' | 'lucy',
    text: string,
  ): Promise<void> {
    ticket.decisions.push({
      at: new Date().toISOString(),
      from,
      question: ticket.question?.text ?? '',
      text,
    });
    ticket.question = null;
    ticket.status = 'developing';
    this.refreshStages(execution);
    await this.enqueue(execution, 'develop', ticket);
  }

  /** El nombre con que se ve al agente de un trabajo (David, Maine…), no el técnico. */
  private agentLabel(
    agent: { displayName?: string | null; name: string } | null,
    job: Job,
  ): string {
    return (
      agent?.displayName?.trim() ||
      agent?.name ||
      job.payload.agent?.name ||
      'Un agente'
    );
  }

  /** Lo que un agente dejó dudoso sin detenerse: queda en el ticket para que Lucy se lo comente al usuario. */
  private async addDoubt(
    ticket: ExecutionTicket,
    job: Job,
    text: string,
  ): Promise<void> {
    const agent = job.payload.agent
      ? await this.agents.getById(job.payload.agent.id)
      : null;
    ticket.doubts = [
      ...(ticket.doubts ?? []),
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        from: this.agentLabel(agent, job),
        text,
      },
    ].slice(-MAX_DOUBTS);
  }

  /** El desarrollador preguntó: el ticket espera y, cuando se guarde, Lucy decide qué hacer con la pregunta. */
  private async ask(
    execution: Execution,
    ticket: ExecutionTicket,
    job: Job,
    text: string,
  ): Promise<void> {
    const agent = job.payload.agent
      ? await this.agents.getById(job.payload.agent.id)
      : null;
    ticket.questionsAsked += 1;
    ticket.question = {
      id: crypto.randomUUID(),
      from: this.agentLabel(agent, job),
      agentId: agent?.id ?? null,
      text,
      recommendation: null,
      askedAt: new Date().toISOString(),
    };
    ticket.status = 'waiting';
    this.refreshStages(execution);
    this.toDecide.set(execution.id, ticket.id);
  }

  /**
   * Lucy lee la pregunta con el plan y el ticket: si ya están respondidos, contesta ella (solo si
   * `EXECUTIONS_LUCY_ANSWERS=true`); si no, deja su recomendación y la pregunta espera al usuario.
   */
  private async lucyDecides(
    executionId: string,
    ticketId: string,
  ): Promise<void> {
    try {
      const execution = await this.executions.findById(executionId);
      const ticket = execution?.tickets.find((t) => t.id === ticketId);
      const question = ticket?.question;
      if (!execution || !ticket || !question || ticket.status !== 'waiting')
        return;

      const [task, plan, lucy] = await Promise.all([
        this.tasks.getTask(execution.issueId),
        this.plans.getPlan(execution.planId),
        this.agents.getDefault('task-tickets'),
      ]);
      const reply = await this.agents.chat({
        prompt: buildQuestionPrompt({
          assistantName: lucy.displayName?.trim() || lucy.name,
          askerName: question.from,
          taskName: task?.name ?? execution.branch,
          plan: plan?.content ?? null,
          ticket,
          question: question.text,
        }),
      });
      const decision = parseDecision(reply.reply);

      // Mientras Lucy pensaba, el usuario pudo contestar o cancelar: solo se sigue si todo está igual.
      const fresh = await this.executions.findById(executionId);
      const current = fresh?.tickets.find((t) => t.id === ticketId);
      if (!fresh?.isActive || !current || current.question?.id !== question.id)
        return;

      if (
        decision?.kind === 'answer' &&
        this.config?.get('EXECUTIONS_LUCY_ANSWERS') === 'true'
      ) {
        await this.resolveQuestion(fresh, current, 'lucy', decision.text);
      } else {
        // Sin permiso para contestar, su respuesta se vuelve una recomendación para el usuario.
        current.question.recommendation = decision?.text ?? null;
      }
      await this.executions.save(fresh);
    } catch (error) {
      // Sin Lucy la pregunta igual espera al usuario.
      this.logger.warn(
        `Lucy could not decide the question of ${executionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async advance(execution: Execution, job: Job): Promise<void> {
    const output = job.result?.output ?? '';

    switch (job.kind) {
      case 'tickets': {
        const drafts = parseTickets(
          output,
          MAX_TICKETS,
          execution.targets().map((target) => target.repo.fullName),
        );
        execution.setTickets(
          drafts.map((draft): ExecutionTicket => ({
            id: crypto.randomUUID(),
            ...draft,
            developerId: null,
            reviewerId: null,
            status: 'pending',
            rounds: 0,
            feedback: null,
            startSha: null,
            headSha: null,
            summary: null,
            reviewNote: null,
            question: null,
            decisions: [],
            questionsAsked: 0,
          })),
        );
        await this.assignTickets(execution);
        execution.setStage('tickets', 'done');
        // Se espera el visto bueno: el usuario puede cambiar quién hace cada ticket antes de empezar.
        execution.awaitStart();
        return;
      }

      case 'develop': {
        const ticket = execution.ticket(job.ticketId);
        const { headBefore, headAfter } = job.result ?? {};
        if (!headAfter || headAfter === headBefore) {
          // No hizo cambios porque no podía seguir sin una respuesta: se la pregunta a Lucy (hasta un tope).
          const asked = parseQuestion(output);
          if (asked && ticket.questionsAsked < MAX_QUESTIONS) {
            await this.ask(execution, ticket, job, asked);
            return;
          }
          // Casi siempre es porque no pudo hacer algo (un comando sin permiso, por ejemplo): su
          // explicación es lo que le sirve a quien lee el error.
          ticket.summary = output.slice(0, MAX_SUMMARY_CHARS) || null;
          const why = output.replace(/\s+/g, ' ').trim().slice(0, 400);
          throw new DomainError(
            `The developer made no changes for the ticket "${ticket.title}"${why ? `: ${why}` : ''}`,
          );
        }
        ticket.startSha ??= headBefore ?? null;
        ticket.headSha = headAfter;
        ticket.summary = output.slice(0, MAX_SUMMARY_CHARS) || null;
        const doubt = parseDoubts(output);
        if (doubt) await this.addDoubt(ticket, job, doubt);
        ticket.feedback = null;
        ticket.status = 'reviewing';
        this.refreshStages(execution);
        await this.enqueue(execution, 'review', ticket);
        return;
      }

      case 'review': {
        const ticket = execution.ticket(job.ticketId);
        const verdict = parseReview(output);
        ticket.rounds += 1;
        ticket.reviewNote = verdict.summary || null;
        if (verdict.doubts) await this.addDoubt(ticket, job, verdict.doubts);

        if (verdict.approved) {
          ticket.status = 'done';
          ticket.feedback = null;
          await this.startNextTicket(execution);
          return;
        }

        const issues = verdict.issues.length
          ? verdict.issues
          : [verdict.summary || 'The reviewer asked for changes'];
        if (ticket.rounds >= MAX_REVIEW_ROUNDS) {
          ticket.status = 'failed';
          ticket.feedback = issues;
          throw new DomainError(
            `The reviewer still asks for changes on "${ticket.title}" after ${ticket.rounds} reviews: ${issues.join('; ')}`,
          );
        }
        ticket.status = 'developing';
        ticket.feedback = issues;
        this.refreshStages(execution);
        await this.enqueue(execution, 'develop', ticket);
        return;
      }

      case 'publish': {
        const baseBranch = job.result?.baseBranch;
        if (!baseBranch) {
          throw new DomainError('The runner did not report the base branch');
        }
        // Cada repositorio sube su rama y abre su PR, uno tras otro.
        const targets = execution.targets();
        const target = execution.targetOf(job.payload.repo.fullName);
        execution.setTargetBaseBranch(target.repo.fullName, baseBranch);

        const task = await this.tasks.getTask(execution.issueId);
        const { url } = await this.pullRequests
          .create({
            host: target.repo.host,
            repo: target.repo.fullName,
            sourceBranch: target.branch,
            destBranch: baseBranch,
            title: task?.name ?? target.branch,
            description: buildPullRequestDescription({
              taskName: task?.name ?? target.branch,
              tickets: execution.tickets.filter(
                (ticket) =>
                  execution.targetOf(ticket.repo).repo.fullName ===
                  target.repo.fullName,
              ),
              otherRepos: targets
                .map((other) => other.repo.fullName)
                .filter((name) => name !== target.repo.fullName),
            }),
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            throw new DomainError(
              `The branch was pushed but the pull request could not be opened: ${message}`,
            );
          });

        execution.setTargetPullRequest(target.repo.fullName, url);

        const next =
          targets[
            targets.findIndex((t) => t.repo.fullName === target.repo.fullName) +
              1
          ];
        if (next) {
          await this.jobs.save(
            await this.buildJob(
              execution,
              'publish',
              undefined,
              1,
              next.repo.fullName,
            ),
          );
          return;
        }
        execution.setStage('publish', 'done');
        execution.complete(execution.pullRequestUrl ?? url);
        return;
      }
    }
  }

  /** Sigue con el próximo ticket sin desarrollar o, si no quedan, publica la rama. */
  private async startNextTicket(execution: Execution): Promise<void> {
    const ticket = execution.nextPendingTicket();
    if (!ticket) {
      this.refreshStages(execution);
      execution.setStage('publish', 'running');
      await this.enqueue(execution, 'publish');
      return;
    }

    ticket.status = 'developing';
    this.refreshStages(execution);
    await this.enqueue(execution, 'develop', ticket);
  }

  private async enqueue(
    execution: Execution,
    kind: StageKey,
    ticket?: ExecutionTicket,
  ): Promise<void> {
    await this.jobs.save(await this.buildJob(execution, kind, ticket));
  }

  private async buildJob(
    execution: Execution,
    kind: StageKey,
    ticket?: ExecutionTicket,
    attempt = 1,
    publishRepo?: string,
  ): Promise<Job> {
    // El trabajo corre en el repositorio de su ticket (o el que se publica); los demás quedan de consulta.
    const target = execution.targetOf(
      kind === 'publish' ? publishRepo : ticket?.repo,
    );
    const others = execution
      .targets()
      .filter((other) => other.repo.fullName !== target.repo.fullName);
    const base = {
      repo: {
        sshUrl: target.repo.sshUrl,
        fullName: target.repo.fullName,
      },
      branch: target.branch,
      ...(kind !== 'publish' && others.length > 0
        ? {
            context: others.map((other) => ({
              sshUrl: other.repo.sshUrl,
              fullName: other.repo.fullName,
              branch: other.branch,
            })),
          }
        : {}),
    };
    const otherRepos = others.map((other) => other.repo.fullName);

    if (kind === 'publish') {
      // Subir la rama no necesita un agente: lo hace el runner solo.
      return Job.create({
        executionId: execution.id,
        kind,
        payload: { ...base, prompt: '', agent: null },
        attempt,
      });
    }

    const agent = await this.agentFor(kind, ticket);
    const plan = await this.planOf(execution);
    const task = await this.tasks.getTask(execution.issueId);
    const repoName = target.repo.fullName;
    const recipe = await this.recipeOf([repoName, ...otherRepos]);
    const payload: JobPayload = {
      ...base,
      agent: this.toJobAgent(agent),
      prompt: '',
    };

    if (kind === 'tickets') {
      payload.prompt = buildTicketsPrompt({
        taskName: task?.name ?? execution.branch,
        taskDescription: task?.description ?? null,
        plan,
        repoName,
        otherRepos,
        recipe,
      });
    } else if (ticket) {
      const index = execution.tickets.indexOf(ticket) + 1;
      if (kind === 'develop') {
        payload.prompt = buildDevelopPrompt({
          ticket,
          index,
          total: execution.tickets.length,
          plan,
          repoName,
          otherRepos,
          recipe,
        });
        payload.commitMessage = `${ticket.title}\n\nTicket ${index}/${execution.tickets.length} de la ejecución ${execution.id.slice(0, 8)} del workbench.`;
      } else {
        payload.prompt = buildReviewPrompt({
          ticket,
          repoName,
          from: ticket.startSha ?? 'HEAD~1',
          developerSummary: ticket.summary,
          otherRepos,
          recipe,
        });
        payload.reviewFrom = ticket.startSha ?? undefined;
      }
    }

    return Job.create({
      executionId: execution.id,
      kind,
      ticketId: ticket?.id ?? null,
      payload,
      attempt,
    });
  }

  /** Las recetas de los repositorios del trabajo; sin ellas se sigue: son una ayuda, no una condición. */
  private async recipeOf(repos: readonly string[]): Promise<string | null> {
    try {
      return (await this.recipes?.contextFor(repos)) ?? null;
    } catch (error) {
      this.logger.warn(
        `The recipes could not be read: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** El agente asignado al ticket para esa etapa y, si ya no existe o no sirve, el que esté por defecto. */
  private async agentFor(
    kind: Exclude<StageKey, 'publish'>,
    ticket?: ExecutionTicket,
  ): Promise<ResolvedAgent> {
    const assigned =
      kind === 'develop'
        ? ticket?.developerId
        : kind === 'review'
          ? ticket?.reviewerId
          : null;
    if (assigned) {
      const agent = await this.agents.getById(assigned);
      if (agent) return agent;
    }
    return this.agents.getDefault(AGENT_OF[kind]);
  }

  /**
   * Reparte los tickets: cada uno al desarrollador de su nivel (o al que esté por defecto si no hay uno
   * de ese nivel) y los revisores por turnos, empezando por el que está por defecto.
   */
  private async assignTickets(execution: Execution): Promise<void> {
    const developers = (
      await this.agents.listByModule('task-developer')
    ).filter((agent) => agent.provider === 'claude');
    const reviewers = (await this.agents.listByModule('task-reviewer')).filter(
      (agent) => agent.provider === 'claude',
    );
    const fallback =
      developers.find((agent) => agent.isDefault) ?? developers[0];

    execution.tickets.forEach((ticket, index) => {
      const ofLevel = developers.find((agent) => agent.level === ticket.level);
      ticket.developerId = (ofLevel ?? fallback)?.id ?? null;
      ticket.reviewerId =
        reviewers.length > 0 ? reviewers[index % reviewers.length].id : null;
    });
  }

  /** Cambia quién desarrolla o revisa un ticket. Solo mientras se espera el visto bueno. */
  async assign(
    id: string,
    ticketId: string,
    data: { developerId?: string; reviewerId?: string },
  ): Promise<Execution> {
    const execution = await this.executions.findById(id);
    if (!execution) {
      throw DomainError.notFound(`Execution with id ${id} not found`);
    }
    if (execution.status !== 'awaiting') {
      throw DomainError.conflict(
        'Tickets can only be reassigned while the execution waits to start',
      );
    }

    const ticket = execution.ticket(ticketId);
    if (data.developerId) {
      await this.assertAgent(data.developerId, 'task-developer');
      ticket.developerId = data.developerId;
    }
    if (data.reviewerId) {
      await this.assertAgent(data.reviewerId, 'task-reviewer');
      ticket.reviewerId = data.reviewerId;
    }
    return this.executions.save(execution);
  }

  /** El visto bueno: empieza a desarrollar los tickets, uno a uno. */
  async begin(id: string): Promise<Execution> {
    const execution = await this.executions.findById(id);
    if (!execution) {
      throw DomainError.notFound(`Execution with id ${id} not found`);
    }
    execution.begin();
    await this.startNextTicket(execution);
    return this.executions.save(execution);
  }

  private async assertAgent(
    agentId: string,
    module: ExecutionAgentModule,
  ): Promise<void> {
    const agent = await this.agents.getById(agentId);
    const valid = (await this.agents.listByModule(module)).some(
      (candidate) => candidate.id === agent?.id,
    );
    if (!agent || !valid) {
      throw new DomainError(`That agent cannot work as ${module}`);
    }
    if (agent.provider !== 'claude') {
      throw new DomainError(
        `The agent "${agent.name}" uses ${agent.provider}; the runner can only run claude agents`,
      );
    }
  }

  private toJobAgent(agent: {
    id: string;
    name: string;
    provider: string;
    model: string;
    systemPrompt: string;
    allowedTools: string[];
    effort: string | null;
  }) {
    if (agent.provider !== 'claude') {
      throw new DomainError(
        `The agent "${agent.name}" uses ${agent.provider}; the runner can only run claude agents`,
      );
    }
    return {
      id: agent.id,
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      allowedTools: agent.allowedTools,
      ...(agent.effort ? { effort: agent.effort } : {}),
    };
  }

  private async planOf(execution: Execution): Promise<string> {
    const plan = await this.plans.getPlan(execution.planId);
    if (!plan) throw new DomainError('The plan of this execution was deleted');
    return plan.content;
  }

  /** Marca la etapa del trabajo como fallida y la ejecución con el motivo. */
  private fail(execution: Execution, job: Job, message: string): void {
    this.refreshStages(execution);
    execution.setStage(job.kind, 'failed');
    execution.fail(message);
  }

  /**
   * El estado de cada etapa sale de los tickets, y solo «corre» la que se está haciendo ahora:
   * desarrollo mientras algún ticket se desarrolla, revisión mientras alguno se revisa. Con varios
   * tickets las dos etapas se repiten; una que espera su próxima vuelta queda en «pendiente».
   */
  private refreshStages(execution: Execution): void {
    const tickets = execution.tickets;
    if (tickets.length === 0) return;

    const developing = tickets.some((ticket) => ticket.status === 'developing');
    const developed = tickets.every(
      (ticket) => ticket.status === 'reviewing' || ticket.status === 'done',
    );
    execution.setStage(
      'develop',
      developing ? 'running' : developed ? 'done' : 'pending',
    );

    const reviewing = tickets.some((ticket) => ticket.status === 'reviewing');
    const reviewed = tickets.every((ticket) => ticket.status === 'done');
    execution.setStage(
      'review',
      reviewing ? 'running' : reviewed ? 'done' : 'pending',
    );
  }
}
