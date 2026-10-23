import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Semaphore } from '@core/async/semaphore';
import { refsOf } from '@core/attachments/attachments';
import { userTexts } from '@planner/domain/conversation';
import { PlanChatMessage } from '@planner/domain/entities/plan.props';
import { repoUrlsOf } from '@planner/domain/task-repos';
import { buildTaskChatPrompt } from '@planner/domain/task-chat-prompt';
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
  REPOS_CACHE_PORT,
  type ReposCachePort,
} from '@planner/domain/ports/repos-cache.port';
import {
  TASKS_GATEWAY_PORT,
  type TasksGatewayPort,
} from '@planner/domain/ports/tasks-gateway.port';
import {
  TICKETS_GATEWAY_PORT,
  type TicketsGatewayPort,
} from '@planner/domain/ports/tickets-gateway.port';
import { readTickets } from '@planner/application/ticket-reader';

/** Cuántas preguntas del chat de tareas se contestan a la vez; las demás esperan su turno. */
export const TASK_CHAT_CONCURRENCY = Symbol('TASK_CHAT_CONCURRENCY');

/** Tickets de Plane que se leen por pregunta: los de la tarea y los que el usuario mencione. */
export const MAX_TICKETS_PER_CHAT = 5;
const TICKET_TIMEOUT_MS = 10_000;

export interface TaskChatReply {
  reply: string;
  agentName: string;
  model: string;
  /** Códigos de los tickets de Plane que se leyeron para contestar. */
  tickets: string[];
  /** La tarea tenía un plan listo, que el agente tuvo a la vista. */
  hasPlan: boolean;
}

/**
 * Chat para mejorar el plan de una tarea. El agente recibe la tarea, sus tickets de Plane (también los
 * que el usuario mencione en la conversación), el último plan listo y el código de los repos de las
 * etiquetas. El plan solo cambia al replanificar (`PlansService.create` con la conversación).
 */
@Injectable()
export class TaskChatService {
  private readonly logger = new Logger(TaskChatService.name);
  private readonly limiter: Semaphore;

  constructor(
    @Inject(TASKS_GATEWAY_PORT)
    private readonly tasks: TasksGatewayPort,
    @Inject(PLAN_REPOSITORY_PORT)
    private readonly plans: PlanRepositoryPort,
    @Inject(TICKETS_GATEWAY_PORT)
    private readonly tickets: TicketsGatewayPort,
    @Inject(REPOS_CACHE_PORT)
    private readonly repos: ReposCachePort,
    @Inject(AGENTS_GATEWAY_PORT)
    private readonly agents: AgentsGatewayPort,
    @Inject(TASK_CHAT_CONCURRENCY) concurrency: number,
    @Inject(ATTACHMENTS_PORT)
    private readonly attachments: AttachmentsPort,
  ) {
    this.limiter = new Semaphore(concurrency);
  }

  async reply(
    issueId: string,
    messages: readonly PlanChatMessage[],
  ): Promise<TaskChatReply> {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || !last.content.trim()) {
      throw new DomainError('The last message of the chat must be the user’s');
    }

    const task = await this.tasks.getTask(issueId);
    if (!task) throw DomainError.notFound(`Issue with id ${issueId} not found`);

    // Lo que el usuario escribió va primero: si menciona un ticket, pesa más que los de la descripción.
    const { tickets, missing } = await readTickets(
      this.tickets,
      [...userTexts(messages), task.name, task.description],
      {
        max: MAX_TICKETS_PER_CHAT,
        timeoutMs: TICKET_TIMEOUT_MS,
        warn: (message) => this.logger.warn(message),
      },
    );
    const plan = (await this.plans.findByIssueId(issueId)).find(
      (candidate) => candidate.status === 'ready' && candidate.content,
    );

    return this.limiter.run(async () => {
      const cached = await this.repos.ensure(issueId, repoUrlsOf(task));
      // Los adjuntos de la conversación quedan a la vista del agente, junto a los repos de la tarea.
      const staged = await this.attachments.stage(
        refsOf(messages),
        cached.path,
      );
      const result = await this.agents.runTaskChat({
        prompt: buildTaskChatPrompt({
          task,
          tickets,
          missingTickets: missing,
          plan: plan?.content ?? null,
          repos: cached.repos,
          messages,
          staged,
        }),
        workdir: cached.path,
      });

      return {
        reply: result.markdown,
        agentName: result.agentName,
        model: result.model,
        tickets: tickets.map((ticket) => ticket.key),
        hasPlan: Boolean(plan),
      };
    });
  }
}
