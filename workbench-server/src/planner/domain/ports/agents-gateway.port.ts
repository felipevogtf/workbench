export interface PlanRunRequest {
  agentId?: string;
  model?: string;
  prompt: string;
  workdir: string;
}

export interface PlanRunResult {
  markdown: string;
  agentId: string;
  agentName: string;
  model: string;
}

export interface TaskChatRunRequest {
  prompt: string;
  workdir: string;
}

export interface TaskChatRunResult {
  markdown: string;
  agentName: string;
  model: string;
}

/** Contrato propio del planificador hacia el módulo ai-agents. */
export interface AgentsGatewayPort {
  /** Genera un plan con un agente del módulo `planner`. */
  runPlan(request: PlanRunRequest): Promise<PlanRunResult>;
  /** Responde en el chat de una tarea con el agente por defecto del módulo `task-chat`. */
  runTaskChat(request: TaskChatRunRequest): Promise<TaskChatRunResult>;
}

export const AGENTS_GATEWAY_PORT = Symbol('PLANNER_AGENTS_GATEWAY_PORT');
