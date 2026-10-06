export interface ReviewRunRequest {
  agentId?: string;
  model?: string;
  prompt: string;
  workdir: string;
}

export interface ReviewRunResult {
  markdown: string;
  agentId: string;
  agentName: string;
  model: string;
}

/** Contrato propio de pr-review hacia el módulo ai-agents. */
export interface AgentsGatewayPort {
  runReview(request: ReviewRunRequest): Promise<ReviewRunResult>;
}

export const AGENTS_GATEWAY_PORT = Symbol('AGENTS_GATEWAY_PORT');
