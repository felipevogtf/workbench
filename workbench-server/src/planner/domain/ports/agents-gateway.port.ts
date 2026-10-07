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

/** Contrato propio del planificador hacia el módulo ai-agents (siempre con agentes del módulo `planner`). */
export interface AgentsGatewayPort {
  runPlan(request: PlanRunRequest): Promise<PlanRunResult>;
}

export const AGENTS_GATEWAY_PORT = Symbol('PLANNER_AGENTS_GATEWAY_PORT');
