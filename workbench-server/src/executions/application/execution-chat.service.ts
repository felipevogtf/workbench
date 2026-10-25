import { Inject, Injectable } from '@nestjs/common';
import { Semaphore } from '@core/async/semaphore';
import { DomainError } from '@core/domain/domain.error';
import {
  buildExecutionChatPrompt,
  type ExecutionChatMessage,
} from '@executions/domain/execution-chat-prompt';
import {
  EXECUTION_REPOSITORY_PORT,
  type ExecutionRepositoryPort,
} from '@executions/domain/ports/execution-repository.port';
import {
  AGENTS_GATEWAY_PORT,
  PLANS_GATEWAY_PORT,
  REPOSITORIES_GATEWAY_PORT,
  TASKS_GATEWAY_PORT,
  type AgentsGatewayPort,
  type PlansGatewayPort,
  type RepositoriesGatewayPort,
  type TasksGatewayPort,
} from '@executions/domain/ports/gateways.port';
import {
  JOB_REPOSITORY_PORT,
  type JobRepositoryPort,
} from '@executions/domain/ports/job-repository.port';

/** Cuántas preguntas se contestan a la vez; las demás esperan su turno. */
const CONCURRENCY = 2;

export interface ExecutionChatReply {
  reply: string;
  agentName: string;
  model: string;
}

/**
 * Chat con Lucy sobre una ejecución. Ella recibe el estado completo (tarea, tickets con quién los tiene,
 * último fallo, plan) y la conversación; solo contesta, no cambia nada. La conversación vive en el
 * navegador y viaja entera con cada pregunta, como en los demás chats.
 */
@Injectable()
export class ExecutionChatService {
  private readonly limiter = new Semaphore(CONCURRENCY);

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
    @Inject(REPOSITORIES_GATEWAY_PORT)
    private readonly repositories: RepositoriesGatewayPort,
  ) {}

  async reply(
    executionId: string,
    messages: readonly ExecutionChatMessage[],
  ): Promise<ExecutionChatReply> {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || !last.content.trim()) {
      throw new DomainError('The last message of the chat must be the user’s');
    }

    const execution = await this.executions.findById(executionId);
    if (!execution) {
      throw DomainError.notFound(`Execution with id ${executionId} not found`);
    }
    const [jobs, task, plan, lucy, code] = await Promise.all([
      this.jobs.findByExecutionId(executionId),
      this.tasks.getTask(execution.issueId),
      this.plans.getPlan(execution.planId),
      this.agents.getDefault('task-tickets'),
      // El código de los repos (rama principal), clonado por la misma caché del plan; si no hay, se sigue sin él.
      this.repositories.ensure(execution.issueId),
    ]);

    // Los nombres con que se ve a cada trabajador (David, Maine…), no los técnicos.
    const names = new Map<string, string>();
    const ids = new Set<string>();
    for (const ticket of execution.tickets) {
      if (ticket.developerId) ids.add(ticket.developerId);
      if (ticket.reviewerId) ids.add(ticket.reviewerId);
    }
    for (const id of ids) {
      const agent = await this.agents.getById(id);
      if (agent) names.set(id, agent.displayName?.trim() || agent.name);
    }

    const prompt = buildExecutionChatPrompt({
      assistantName: lucy.displayName?.trim() || lucy.name,
      taskName: task?.name ?? execution.branch,
      taskDescription: task?.description ?? null,
      execution,
      jobs,
      plan: plan?.content ?? null,
      nameOf: (agentId) =>
        (agentId && names.get(agentId)) || 'el agente por defecto',
      messages,
      repos: code?.repos,
    });

    // Con algún repo leíble, Lucy trabaja en la carpeta de la caché; si no, en una vacía.
    const workdir = code?.repos.some((repo) => repo.used)
      ? code.path
      : undefined;
    return this.limiter.run(() => this.agents.chat({ prompt, workdir }));
  }
}
