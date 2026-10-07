export type AgentProvider = 'claude' | 'copilot' | 'antigravity';

/** CLI de IA con el que corre un agente, con los modelos que ofrece y si está habilitado. */
export interface ProviderStatus {
  id: AgentProvider;
  label: string;
  models: string[];
  enabled: boolean;
}

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  provider: AgentProvider;
  model: string;
  allowedTools: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentInput {
  name: string;
  systemPrompt: string;
  provider: AgentProvider;
  model: string;
  allowedTools: string[];
}

/**
 * Herramientas que el backend permite a un agente (todas de solo lectura).
 * Espejo de `ALLOWED_AGENT_TOOLS` en workbench-server; si el backend rechaza otra, devuelve un 400
 * con la lista real.
 */
export const ALLOWED_AGENT_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
] as const;
