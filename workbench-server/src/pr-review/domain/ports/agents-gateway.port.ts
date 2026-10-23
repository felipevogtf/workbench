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

export interface ChatRunRequest {
  prompt: string;
  /** Directorio donde el agente puede leer. */
  workdir: string;
}

export interface ChatRunResult {
  markdown: string;
  agentName: string;
  model: string;
}

/** Contrato propio de pr-review hacia el módulo ai-agents. */
export interface AgentsGatewayPort {
  runReview(request: ReviewRunRequest): Promise<ReviewRunResult>;
  /** Responde en el chat con el agente por defecto del módulo `chat`. */
  runChat(request: ChatRunRequest): Promise<ChatRunResult>;
}

export const AGENTS_GATEWAY_PORT = Symbol('AGENTS_GATEWAY_PORT');
