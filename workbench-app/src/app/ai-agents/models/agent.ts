export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  allowedTools: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentInput {
  name: string;
  systemPrompt: string;
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

/** Sugerencias de modelo; el campo acepta cualquier id. */
export const MODEL_SUGGESTIONS = [
  'claude-sonnet-5-5',
  'claude-opus-5-5',
  'claude-haiku-4-5-20251001',
] as const;
