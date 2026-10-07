import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { extractTicketKeys } from '@tasks/domain/ticket-keys';
import { Plan } from '@planner/domain/entities/plan.entity';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';
import { buildPlanPrompt } from '@planner/domain/plan-prompt';
import {
  AGENTS_GATEWAY_PORT,
  type AgentsGatewayPort,
} from '@planner/domain/ports/agents-gateway.port';
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

export const PLANNER_CONCURRENCY = Symbol('PLANNER_CONCURRENCY');

/** Máximo de repositorios que se clonan por plan (acota el tiempo y el disco). */
export const MAX_REPOS_PER_PLAN = 3;
/** Máximo de tickets de Plane citados que se leen por plan. */
export const MAX_TICKETS_PER_PLAN = 3;
const TICKET_TIMEOUT_MS = 10_000;

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);
  private activeWorkers = 0;
  private rekick = false;

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
    private readonly concurrency: number,
  ) {}

  /** Deja un plan en cola. Quien encola nunca genera: solo despierta a los workers. */
  async create(
    issueId: string,
    override: { agentId?: string; model?: string } = {},
  ): Promise<Plan> {
    if (!(await this.tasks.getTask(issueId))) {
      throw new NotFoundException(`Issue with id ${issueId} not found`);
    }
    if (await this.plans.findActiveByIssueId(issueId)) {
      throw new ConflictException(
        'This task already has a plan being generated',
      );
    }

    const plan = await this.plans.save(Plan.create({ issueId, ...override }));
    this.kick();
    return plan;
  }

  listByIssue(issueId: string): Promise<Plan[]> {
    return this.plans.findByIssueId(issueId);
  }

  async get(id: string): Promise<Plan> {
    const plan = await this.plans.findById(id);
    if (!plan) throw new NotFoundException(`Plan with id ${id} not found`);
    return plan;
  }

  async delete(id: string): Promise<void> {
    const plan = await this.get(id);
    if (plan.isActive) {
      throw new ConflictException(
        'A plan that is queued or being generated cannot be deleted',
      );
    }
    await this.plans.delete(id);
  }

  kick(): void {
    if (this.activeWorkers >= this.concurrency) {
      // Todos los workers están ocupados; que revisen la cola otra vez al terminar.
      this.rekick = true;
      return;
    }

    while (this.activeWorkers < this.concurrency) {
      this.activeWorkers++;
      void this.runWorker();
    }
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

  private async runWorker(): Promise<void> {
    try {
      for (;;) {
        this.rekick = false;
        const plan = await this.plans.claimNextPending();

        if (!plan) {
          // Si alguien encoló mientras consultábamos, damos otra vuelta.
          if (this.rekick) continue;
          return;
        }

        await this.execute(plan);
      }
    } catch (error) {
      this.logger.error(`Plan worker crashed: ${this.errorMessage(error)}`);
    } finally {
      this.activeWorkers--;
    }
  }

  /** Recibe un plan ya reclamado (`generating`). Nunca lanza: registra el fallo en el plan. */
  private async execute(plan: Plan): Promise<void> {
    this.logger.log(`Planning issue ${plan.issueId}`);
    let repos: PlanRepoInfo[] = [];
    let checkout: ReposCheckout | null = null;

    try {
      const task = await this.tasks.getTask(plan.issueId);
      if (!task) throw new Error('The task no longer exists');

      const tickets = await this.loadTickets(task);
      checkout = await this.checkoutPort.checkout(this.repoUrls(task));
      repos = checkout.repos;

      const result = await this.agents.runPlan({
        agentId: plan.requestedAgentId ?? undefined,
        model: plan.requestedModel ?? undefined,
        prompt: buildPlanPrompt({ task, tickets, repos }),
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

  /** Repositorios de las etiquetas (sin repetidos, por nombre de etiqueta), hasta el máximo. */
  private repoUrls(task: TaskContext): string[] {
    const urls = [...task.labels]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .flatMap((label) => (label.repoUrl ? [label.repoUrl] : []));
    return [...new Set(urls)].slice(0, MAX_REPOS_PER_PLAN);
  }

  /** Tickets de Plane citados en el título o la descripción. Nunca bloquea el plan. */
  private async loadTickets(task: TaskContext): Promise<TicketData[]> {
    try {
      const identifiers = await this.withTimeout(
        this.tickets.getProjectIdentifiers(),
      );
      const keys = extractTicketKeys(
        [task.name, task.description],
        identifiers,
        MAX_TICKETS_PER_PLAN,
      );

      const found = await Promise.all(
        keys.map(async (key) => {
          try {
            return await this.withTimeout(this.tickets.getTicket(key));
          } catch (error) {
            this.logger.warn(
              `Could not read ticket ${key}: ${this.errorMessage(error)}`,
            );
            return null;
          }
        }),
      );
      return found.filter((ticket): ticket is TicketData => ticket !== null);
    } catch (error) {
      this.logger.warn(
        `Could not read Plane tickets: ${this.errorMessage(error)}`,
      );
      return [];
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out after ${TICKET_TIMEOUT_MS} ms`)),
        TICKET_TIMEOUT_MS,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
