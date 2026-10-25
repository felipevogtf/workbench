/** Lo que la ejecución necesita saber de una tarea. */
export interface ExecutionTask {
  id: string;
  name: string;
  /** Texto plano. */
  description: string | null;
  /** Repositorios de sus etiquetas, ya normalizados. */
  repoUrls: string[];
}

export interface TasksGatewayPort {
  /** `null` si la tarea no existe. */
  getTask(issueId: string): Promise<ExecutionTask | null>;
}
export const TASKS_GATEWAY_PORT = Symbol('EXECUTIONS_TASKS_GATEWAY_PORT');

export interface ReadyPlan {
  id: string;
  content: string;
}

export interface PlansGatewayPort {
  /** El último plan listo de la tarea, o `null` si todavía no tiene. */
  getLatestReadyPlan(issueId: string): Promise<ReadyPlan | null>;
  /** Un plan por su id, o `null` si ya no existe. */
  getPlan(id: string): Promise<ReadyPlan | null>;
}
export const PLANS_GATEWAY_PORT = Symbol('EXECUTIONS_PLANS_GATEWAY_PORT');

export type ExecutionAgentModule =
  'task-tickets' | 'task-developer' | 'task-reviewer';

export interface ResolvedAgent {
  id: string;
  name: string;
  /** Cómo se muestra en la app (ej. «David»); `null` = su nombre técnico. */
  displayName: string | null;
  /** El runner solo sabe correr `claude`. */
  provider: string;
  model: string;
  systemPrompt: string;
  allowedTools: string[];
  /** Esfuerzo con que trabaja; `null` = el del modelo. */
  effort: string | null;
  /** Solo desarrolladores: el tamaño de ticket que les toca. */
  level: string | null;
  isDefault: boolean;
}

export interface AgentsGatewayPort {
  /** El agente por defecto del módulo. */
  getDefault(module: ExecutionAgentModule): Promise<ResolvedAgent>;
  /** Todos los agentes del módulo, el por defecto primero. */
  listByModule(module: ExecutionAgentModule): Promise<ResolvedAgent[]>;
  /** Un agente por su id, o `null` si ya no existe. */
  getById(id: string): Promise<ResolvedAgent | null>;
  /** Conversa como la líder de tickets (Lucy): responde con texto, sin tocar nada. */
  chat(request: { prompt: string }): Promise<AgentChatReply>;
}

export interface AgentChatReply {
  reply: string;
  agentName: string;
  model: string;
}
export const AGENTS_GATEWAY_PORT = Symbol('EXECUTIONS_AGENTS_GATEWAY_PORT');

export interface NewPullRequest {
  host: string;
  /** `organización/repo`. */
  repo: string;
  sourceBranch: string;
  destBranch: string;
  title: string;
  description: string;
}

export interface PullRequestsGatewayPort {
  /** Abre la PR y devuelve su enlace. */
  create(request: NewPullRequest): Promise<{ url: string }>;
}
export const PULL_REQUESTS_GATEWAY_PORT = Symbol(
  'EXECUTIONS_PULL_REQUESTS_GATEWAY_PORT',
);
