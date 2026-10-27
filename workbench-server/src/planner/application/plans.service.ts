import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { WorkQueue } from '@core/queue/work-queue';
import { Plan } from '@planner/domain/entities/plan.entity';
import { refsOf, type StagedAttachment } from '@core/attachments/attachments';
import { userTexts } from '@planner/domain/conversation';
import {
  PlanChatMessage,
  PlanRepoInfo,
} from '@planner/domain/entities/plan.props';
import { readTickets } from '@planner/application/ticket-reader';
import { MAX_REPOS_PER_PLAN, repoUrlsOf } from '@planner/domain/task-repos';
import { buildPlanPrompt } from '@planner/domain/plan-prompt';
import {
  AGENTS_GATEWAY_PORT,
  type AgentsGatewayPort,
} from '@planner/domain/ports/agents-gateway.port';
import {
  ATTACHMENTS_PORT,
  type AttachmentsPort,
} from '@planner/domain/ports/attachments.port';
import {
  PLAN_REPOSITORY_PORT,
  type PlanRepositoryPort,
} from '@planner/domain/ports/plan-repository.port';
import {
  REPOS_CHECKOUT_PORT,
  type ReposCheckout,
  type ReposCheckoutPort,
} from '@planner/domain/ports/repos-checkout.port';
import {
  TASKS_GATEWAY_PORT,
  type TaskContext,
  type TasksGatewayPort,
} from '@planner/domain/ports/tasks-gateway.port';
import {
  TICKETS_GATEWAY_PORT,
  type TicketData,
  type TicketsGatewayPort,
} from '@planner/domain/ports/tickets-gateway.port';
import { PlanRevision } from '@planner/domain/plan-prompt';

export const PLANNER_CONCURRENCY = Symbol('PLANNER_CONCURRENCY');

export { MAX_REPOS_PER_PLAN };
/** Máximo de tickets de Plane citados que se leen por plan. */
export const MAX_TICKETS_PER_PLAN = 3;
const TICKET_TIMEOUT_MS = 10_000;

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);
  private readonly queue: WorkQueue<Plan>;

  constructor(
    @Inject(PLAN_REPOSITORY_PORT)
    private readonly plans: PlanRepositoryPort,
    @Inject(TASKS_GATEWAY_PORT)
    private readonly tasks: TasksGatewayPort,
    @Inject(AGENTS_GATEWAY_PORT)
    private readonly agents: AgentsGatewayPort,
    @Inject(REPOS_CHECKOUT_PORT)
    private readonly checkoutPort: ReposCheckoutPort,
    @Inject(TICKETS_GATEWAY_PORT)
    private readonly tickets: TicketsGatewayPort,
    @Inject(PLANNER_CONCURRENCY)
    concurrency: number,
    @Inject(ATTACHMENTS_PORT)
    private readonly attachments: AttachmentsPort,
  ) {
    this.queue = new WorkQueue<Plan>({
      name: 'PlansService',
      concurrency,
      claim: () => this.plans.claimNextPending(),
      process: (plan) => this.execute(plan),
    });
  }

  /**
   * Deja un plan en cola. Quien encola nunca genera: solo despierta a los workers.
   *
   * Con `revision` es una replanificación: el plan nuevo parte del último plan listo (solo ese, aunque
   * el historial tenga más) y de la conversación que se le pasa.
   */
  async create(
    issueId: string,
    override: { agentId?: string; model?: string } = {},
    revision?: { messages: PlanChatMessage[] },
  ): Promise<Plan> {
    const task = await this.tasks.getTask(issueId);
    if (!task) {
      throw DomainError.notFound(`Issue with id ${issueId} not found`);
    }
    if (task.groupId) {
      throw DomainError.conflict(
        'This task belongs to a group: the plan is made for the whole group',
      );
    }
    if (await this.plans.findActiveByIssueId(issueId)) {
      throw DomainError.conflict(
        'This task already has a plan being generated',
      );
    }

    let conversation: PlanChatMessage[] | undefined;
    let basedOnPlanId: string | null = null;
    if (revision) {
      if (
        !revision.messages.some((m) => m.role === 'user' && m.content.trim())
      ) {
        throw new DomainError(
          'A conversation with the user is needed to replan',
        );
      }
      conversation = revision.messages;
      const latest = (await this.plans.findByIssueId(issueId)).find(
        (candidate) => candidate.status === 'ready' && candidate.content,
      );
      basedOnPlanId = latest?.id ?? null;
    }

    const plan = await this.plans.save(
      Plan.create({ issueId, ...override, conversation, basedOnPlanId }),
    );
    this.kick();
    return plan;
  }

  listByIssue(issueId: string): Promise<Plan[]> {
    return this.plans.findByIssueId(issueId);
  }

  async get(id: string): Promise<Plan> {
    const plan = await this.plans.findById(id);
    if (!plan) throw DomainError.notFound(`Plan with id ${id} not found`);
    return plan;
  }

  async delete(id: string): Promise<void> {
    const plan = await this.get(id);
    if (plan.isActive) {
      throw DomainError.conflict(
        'A plan that is queued or being generated cannot be deleted',
      );
    }
    await this.plans.delete(id);
  }

  kick(): void {
    this.queue.kick();
  }

  /**
   * Al arrancar: lo que quedó `generating` por un corte no terminó, así que pasa a `failed` (se pide
   * otro plan a mano). Los `pending` se retoman.
   */
  async recoverInterrupted(): Promise<number> {
    const interrupted = await this.plans.findByStatus('generating');
    for (const plan of interrupted) {
      plan.fail('Interrupted by a server restart');
      await this.plans.save(plan);
    }

    this.kick();
    return interrupted.length;
  }

  /** Recibe un plan ya reclamado (`generating`). Nunca lanza: registra el fallo en el plan. */
  private async execute(plan: Plan): Promise<void> {
    this.logger.log(`Planning issue ${plan.issueId}`);
    let repos: PlanRepoInfo[] = [];
    let checkout: ReposCheckout | null = null;

    try {
      const task = await this.tasks.getTask(plan.issueId);
      if (!task) throw new Error('The task no longer exists');

      const revision = await this.revisionOf(plan);
      const tickets = await this.loadTickets(
        task,
        // Los tickets que el usuario mencionó al conversar también entran al contexto.
        revision ? userTexts(revision.conversation) : [],
      );
      checkout = await this.checkoutPort.checkout(repoUrlsOf(task));
      repos = checkout.repos;

      // Los adjuntos de la conversación se dejan en el directorio del plan (que se borra al terminar).
      if (revision) {
        revision.staged = await this.stageAttachments(revision, checkout.path);
      }

      const result = await this.agents.runPlan({
        agentId: plan.requestedAgentId ?? undefined,
        model: plan.requestedModel ?? undefined,
        prompt: buildPlanPrompt({ task, tickets, repos, revision }),
        workdir: checkout.path,
      });

      plan.complete({
        content: result.markdown,
        agentId: result.agentId,
        agentName: result.agentName,
        model: result.model,
        repos,
      });
    } catch (error) {
      const message = this.errorMessage(error);
      this.logger.warn(`Plan failed for issue ${plan.issueId}: ${message}`);
      plan.fail(message, repos);
    } finally {
      if (checkout) await checkout.dispose().catch(() => undefined);
    }

    try {
      await this.plans.save(plan);
    } catch (error) {
      this.logger.error(`Could not save the plan: ${this.errorMessage(error)}`);
    }
  }

  /** Deja los adjuntos al alcance del agente. Si no se pueden dejar, el plan sigue sin ellos. */
  private async stageAttachments(
    revision: PlanRevision,
    workdir: string,
  ): Promise<ReadonlyMap<string, StagedAttachment>> {
    try {
      return await this.attachments.stage(
        refsOf(revision.conversation),
        workdir,
      );
    } catch (error) {
      this.logger.warn(
        `Could not stage the attachments: ${this.errorMessage(error)}`,
      );
      return new Map();
    }
  }

  /** Lo que una replanificación agrega al prompt; null en un plan normal. */
  private async revisionOf(plan: Plan): Promise<PlanRevision | null> {
    const conversation = plan.conversation;
    if (!conversation) return null;

    // Solo el plan del que parte, no el historial entero. Si ya se borró, se replanifica sin él.
    const previous = plan.basedOnPlanId
      ? await this.plans.findById(plan.basedOnPlanId)
      : null;
    return { previousPlan: previous?.content ?? null, conversation };
  }

  /** Tickets de Plane citados en lo que se pasa y en el título o la descripción. Nunca bloquea el plan. */
  private async loadTickets(
    task: TaskContext,
    extraTexts: string[] = [],
  ): Promise<TicketData[]> {
    const { tickets } = await readTickets(
      this.tickets,
      [...extraTexts, task.name, task.description],
      {
        max: MAX_TICKETS_PER_PLAN,
        timeoutMs: TICKET_TIMEOUT_MS,
        warn: (message) => this.logger.warn(message),
      },
    );
    return tickets;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
