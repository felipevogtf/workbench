import { Inject, Injectable, Logger } from '@nestjs/common';
import { Semaphore } from '@core/async/semaphore';
import { DomainError } from '@core/domain/domain.error';
import {
  buildExecutionChatPrompt,
  type ExecutionChatMessage,
} from '@executions/domain/execution-chat-prompt';
import {
  extractProposals,
  promisesAButton,
  type ChatProposal,
} from '@executions/domain/chat-proposals';
import type { Execution } from '@executions/domain/entities/execution.entity';
import {
  EXECUTION_REPOSITORY_PORT,
  type ExecutionRepositoryPort,
} from '@executions/domain/ports/execution-repository.port';
import {
  AGENTS_GATEWAY_PORT,
  PLANS_GATEWAY_PORT,
  REPOSITORIES_GATEWAY_PORT,
  TASKS_GATEWAY_PORT,
  type AgentChatReply,
  type AgentsGatewayPort,
  type PlansGatewayPort,
  type ResolvedAgent,
  type RepositoriesGatewayPort,
  type TasksGatewayPort,
} from '@executions/domain/ports/gateways.port';
import {
  JOB_REPOSITORY_PORT,
  type JobRepositoryPort,
} from '@executions/domain/ports/job-repository.port';
import { ExecutionsService } from './executions.service';
import { RunnersService } from './runners.service';

/** Lo que se agrega cuando Lucy habla de un botón que no se pudo armar. */
const MISSING_BUTTON =
  '\n\n_No pude armar el botón de esa propuesta. Pídemela de nuevo («ponla en su línea»), o hazlo desde el panel del ticket._';

/** Cuántas preguntas se contestan a la vez; las demás esperan su turno. */
const CONCURRENCY = 2;

/**
 * Si el runner no toma la pregunta en este tiempo (está ocupado con otro trabajo: solo hace uno a la vez), Lucy contesta
 * como siempre, con el código de la rama principal, en vez de dejar esperando al usuario.
 */
const RUNNER_CLAIM_MS = 30_000;
/** Lo más que se espera la respuesta del runner, que puede tener que levantar el entorno del proyecto antes de leer. */
const RUNNER_ANSWER_MS = 12 * 60_000;
const RUNNER_POLL_MS = 1_000;

export interface ExecutionChatReply {
  reply: string;
  agentName: string;
  model: string;
  /** Lo que Lucy propone (notas, tickets, la revisión final) y el usuario puede confirmar con un botón. */
  proposals: ChatProposal[];
}

/**
 * Chat con Lucy sobre una ejecución. Ella recibe el estado completo (tarea, tickets con quién los tiene,
 * último fallo, plan) y la conversación; solo contesta, no cambia nada. La conversación vive en el
 * navegador y viaja entera con cada pregunta, como en los demás chats.
 *
 * Con un runner conectado y libre contesta allí, dentro de la rama de la ejecución: ve el trabajo hecho, las dependencias
 * (`vendor/`) y puede comprobar cosas en el entorno de pruebas. Si no, contesta en el servidor, con la rama principal.
 */
@Injectable()
export class ExecutionChatService {
  private readonly logger = new Logger(ExecutionChatService.name);
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
    private readonly executionsService: ExecutionsService,
    private readonly runners: RunnersService,
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
    const [jobs, task, plan, lucy] = await Promise.all([
      this.jobs.findByExecutionId(executionId),
      this.tasks.getTask(execution.issueId),
      this.plans.getPlan(execution.planId),
      this.agents.getDefault('task-tickets'),
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

    const input = {
      assistantName: lucy.displayName?.trim() || lucy.name,
      taskName: task?.name ?? execution.branch,
      taskDescription: task?.description ?? null,
      execution,
      // Las preguntas que contesta el runner no son parte de lo que pasó en la ejecución.
      jobs: jobs.filter((job) => job.kind !== 'chat'),
      plan: plan?.content ?? null,
      nameOf: (agentId: string | null) =>
        (agentId && names.get(agentId)) || 'el agente por defecto',
      messages,
    };

    const answer = await this.limiter.run(async () => {
      const onRunner = await this.askRunner(
        execution,
        lucy,
        buildExecutionChatPrompt({ ...input, onRunner: true }),
      );
      if (onRunner) return onRunner;

      // El código de los repos (rama principal), clonado por la misma caché del plan; si no hay, se sigue sin él.
      const code = await this.repositories.ensure(execution.issueId);
      const prompt = buildExecutionChatPrompt({ ...input, repos: code?.repos });
      // Con algún repo leíble, Lucy trabaja en la carpeta de la caché; si no, en una vacía.
      const workdir = code?.repos.some((repo) => repo.used)
        ? code.path
        : undefined;
      return this.agents.chat({ prompt, workdir });
    });
    // Lo que propone Lucy no va en el texto: el usuario lo confirma con un botón.
    const { reply, proposals } = extractProposals(answer.reply, {
      tickets: execution.tickets,
      status: execution.status,
      finalReviewRunning: execution.finalReview?.status === 'running',
      repos: execution.targets().map((target) => target.repo.fullName),
    });
    // Si prometió un botón y no escribió la línea que lo crea, se le dice al usuario en vez de dejarlo esperando.
    const missing =
      proposals.length === 0 && promisesAButton(reply) ? MISSING_BUTTON : '';
    return { ...answer, reply: `${reply}${missing}`, proposals };
  }
  /**
   * La pregunta la contesta un runner, en la rama de la ejecución. `null` si no hay runner, si no la toma a tiempo, si
   * tarda demasiado o si falla: quien llama contesta entonces desde el servidor.
   */
  private async askRunner(
    execution: Execution,
    lucy: ResolvedAgent,
    prompt: string,
  ): Promise<AgentChatReply | null> {
    try {
      if (!(await this.runners.anyOnline())) return null;
      const queued = await this.executionsService.queueChat(
        execution,
        lucy,
        prompt,
      );
      const since = Date.now();
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, RUNNER_POLL_MS));
        const job = await this.jobs.findById(queued.id);
        if (!job) return null;

        if (job.status === 'done') {
          const reply = job.result?.output?.trim();
          return reply
            ? { reply, agentName: lucy.name, model: lucy.model }
            : null;
        }
        if (job.status === 'failed' || job.status === 'cancelled') {
          this.logger.warn(
            `Lucy's answer on the runner failed: ${job.error ?? job.status}`,
          );
          return null;
        }
        const waited = Date.now() - since;
        const unclaimed = job.status === 'pending' && waited > RUNNER_CLAIM_MS;
        if (unclaimed || waited > RUNNER_ANSWER_MS) {
          // Si ya corría, el runner lo detiene en su próximo latido.
          job.cancel();
          await this.jobs.save(job);
          return null;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Lucy could not answer on the runner: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
