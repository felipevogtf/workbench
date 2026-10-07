/** Módulo de la app al que sirve un agente (cada módulo tiene su agente por defecto). */
export type AgentModule = 'pr-review' | 'planner';

export const MODULE_OPTIONS: readonly { value: AgentModule; label: string }[] = [
  { value: 'pr-review', label: 'Revisión de PRs' },
  { value: 'planner', label: 'Planificador' },
];

export function moduleLabel(module: AgentModule): string {
  return MODULE_OPTIONS.find((option) => option.value === module)?.label ?? module;
}

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
  module: AgentModule;
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
  module: AgentModule;
  provider: AgentProvider;
  model: string;
  allowedTools: string[];
}

/**
 * Herramientas que el backend permite a un agente de cada módulo (todas de solo lectura).
 * Espejo de `MODULE_TOOLS` en workbench-server; si el backend rechaza otra, devuelve un 400
 * con la lista real.
 */
export const MODULE_TOOLS: Record<AgentModule, readonly string[]> = {
  'pr-review': ['Read', 'Grep', 'Glob', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)'],
  planner: ['Read', 'Grep', 'Glob', 'Bash(git log:*)', 'Bash(git show:*)'],
};
