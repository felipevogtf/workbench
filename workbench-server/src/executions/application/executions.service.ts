import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { Execution } from '@executions/domain/entities/execution.entity';
import {
  ExecutionTicket,
  StageKey,
} from '@executions/domain/entities/execution.props';
import { Job } from '@executions/domain/entities/job.entity';
import { JobPayload } from '@executions/domain/entities/job.props';
import { parseReview, parseTickets } from '@executions/domain/json-output';
import {
  buildDevelopPrompt,
  buildPullRequestDescription,
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
  TASKS_GATEWAY_PORT,
  type AgentsGatewayPort,
  type ExecutionAgentModule,
  type PlansGatewayPort,
  type PullRequestsGatewayPort,
  type TasksGatewayPort,
} from '@executions/domain/ports/gateways.port';

const MAX_SUMMARY_CHARS = 4000;
/** Por ahora las PRs solo se abren en Bitbucket. */
const SUPPORTED_HOST = 'bitbucket.org';

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
  ) {}

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

    if (task.repoUrls.length !== 1) {
      throw new DomainError(
        task.repoUrls.length === 0
          ? 'The task has no repository: add a label with a repository link'
          : 'The task has several repositories; for now a task can only run on one',
      );
    }
    const repo = parseRepo(task.repoUrls[0]);
    if (repo.host !== SUPPORTED_HOST) {
      throw new DomainError(
        'For now the pull request can only be opened on Bitbucket',
      );
    }

    // Que no falte ningún agente (ni sea de otro CLI) antes de gastar tiempo en la primera etapa.
    for (const module of Object.values(AGENT_OF)) {
      await this.agents.getDefault(module);
    }

    const id = crypto.randomUUID();
    const execution = Execution.create({
      id,
      issueId,
      planId: plan.id,
      repo,
      branch: branchNameFor(task.name, id),
    });
    execution.setStage('tickets', 'running');

    const job = await this.buildJob(execution, 'tickets');
    await this.executions.save(execution);
    await this.jobs.save(job);
    return execution;
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
      this.refreshStages(execution);
      next = last.retry();
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
  }

  private async advance(execution: Execution, job: Job): Promise<void> {
    const output = job.result?.output ?? '';

    switch (job.kind) {
      case 'tickets': {
        const drafts = parseTickets(output, MAX_TICKETS);
        execution.setTickets(
          drafts.map((draft): ExecutionTicket => ({
            id: crypto.randomUUID(),
            ...draft,
            status: 'pending',
            rounds: 0,
            feedback: null,
            startSha: null,
            headSha: null,
            summary: null,
            reviewNote: null,
          })),
        );
        execution.setStage('tickets', 'done');
        await this.startNextTicket(execution);
        return;
      }

      case 'develop': {
        const ticket = execution.ticket(job.ticketId);
        const { headBefore, headAfter } = job.result ?? {};
        if (!headAfter || headAfter === headBefore) {
          throw new DomainError(
            `The developer made no changes for the ticket "${ticket.title}"`,
          );
        }
        ticket.startSha ??= headBefore ?? null;
        ticket.headSha = headAfter;
        ticket.summary = output.slice(0, MAX_SUMMARY_CHARS) || null;
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
        execution.setBaseBranch(baseBranch);

        const task = await this.tasks.getTask(execution.issueId);
        const { url } = await this.pullRequests
          .create({
            host: execution.repo.host,
            repo: execution.repo.fullName,
            sourceBranch: execution.branch,
            destBranch: baseBranch,
            title: task?.name ?? execution.branch,
            description: buildPullRequestDescription({
              taskName: task?.name ?? execution.branch,
              tickets: execution.tickets,
            }),
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            throw new DomainError(
              `The branch was pushed but the pull request could not be opened: ${message}`,
            );
          });

        execution.setStage('publish', 'done');
        execution.complete(url);
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
  ): Promise<Job> {
    const base = {
      repo: {
        sshUrl: execution.repo.sshUrl,
        fullName: execution.repo.fullName,
      },
      branch: execution.branch,
    };

    if (kind === 'publish') {
      // Subir la rama no necesita un agente: lo hace el runner solo.
      return Job.create({
        executionId: execution.id,
        kind,
        payload: { ...base, prompt: '', agent: null },
      });
    }

    const agent = await this.agents.getDefault(AGENT_OF[kind]);
    const plan = await this.planOf(execution);
    const task = await this.tasks.getTask(execution.issueId);
    const repoName = execution.repo.fullName;
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
        });
        payload.commitMessage = `${ticket.title}\n\nTicket ${index}/${execution.tickets.length} de la ejecución ${execution.id.slice(0, 8)} del workbench.`;
      } else {
        payload.prompt = buildReviewPrompt({
          ticket,
          repoName,
          from: ticket.startSha ?? 'HEAD~1',
          developerSummary: ticket.summary,
        });
        payload.reviewFrom = ticket.startSha ?? undefined;
      }
    }

    return Job.create({
      executionId: execution.id,
      kind,
      ticketId: ticket?.id ?? null,
      payload,
    });
  }

  private toJobAgent(agent: {
    name: string;
    provider: string;
    model: string;
    systemPrompt: string;
    allowedTools: string[];
  }) {
    if (agent.provider !== 'claude') {
      throw new DomainError(
        `The agent "${agent.name}" uses ${agent.provider}; the runner can only run claude agents`,
      );
    }
    return {
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      allowedTools: agent.allowedTools,
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

  /** El estado de cada etapa sale de los tickets: es lo único que cambia durante la ejecución. */
  private refreshStages(execution: Execution): void {
    const tickets = execution.tickets;
    if (tickets.length === 0) return;

    const developed = tickets.every(
      (ticket) => ticket.status === 'reviewing' || ticket.status === 'done',
    );
    const started = tickets.some((ticket) => ticket.status !== 'pending');
    execution.setStage(
      'develop',
      developed ? 'done' : started ? 'running' : 'pending',
    );

    const reviewed = tickets.every((ticket) => ticket.status === 'done');
    const reviewing = tickets.some(
      (ticket) =>
        ticket.status === 'reviewing' ||
        ticket.status === 'done' ||
        ticket.rounds > 0,
    );
    execution.setStage(
      'review',
      reviewed ? 'done' : reviewing ? 'running' : 'pending',
    );
  }
}
