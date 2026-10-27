/** Módulo de la app al que sirve un agente (cada módulo tiene su agente por defecto). */
export type AgentModule =
  | 'pr-review'
  | 'planner'
  | 'chat'
  | 'task-chat'
  | 'task-tickets'
  | 'task-developer'
  | 'task-reviewer';

export const MODULE_OPTIONS: readonly { value: AgentModule; label: string }[] = [
  { value: 'pr-review', label: 'Revisión de PRs' },
  { value: 'planner', label: 'Planificador' },
  { value: 'chat', label: 'Chat' },
  { value: 'task-chat', label: 'Chat de tareas' },
  { value: 'task-tickets', label: 'Creador de tickets' },
  { value: 'task-developer', label: 'Desarrollador' },
  { value: 'task-reviewer', label: 'Revisor' },
];

/** El orden en que se listan los trabajadores: primero los de la ejecución de tareas. */
export const MODULE_ORDER: readonly AgentModule[] = [
  'task-tickets',
  'task-developer',
  'task-reviewer',
  'pr-review',
  'planner',
  'task-chat',
  'chat',
];

export function moduleLabel(module: AgentModule): string {
  return MODULE_OPTIONS.find((option) => option.value === module)?.label ?? module;
}

export type AgentEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type AgentLevel = 'simple' | 'medium' | 'complex';

export const EFFORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Automático (el del modelo)' },
  { value: 'low', label: 'Bajo' },
  { value: 'medium', label: 'Medio' },
  { value: 'high', label: 'Alto' },
  { value: 'xhigh', label: 'Muy alto' },
  { value: 'max', label: 'Máximo' },
];

export const LEVEL_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Sin nivel' },
  { value: 'simple', label: 'Simple' },
  { value: 'medium', label: 'Medio' },
  { value: 'complex', label: 'Complejo' },
];

export function effortLabel(effort: AgentEffort | null | undefined): string {
  if (!effort) return 'Auto';
  return EFFORT_OPTIONS.find((option) => option.value === effort)?.label ?? effort;
}

/** De menor a mayor: así se ordenan los desarrolladores de una misma lista. */
export const LEVEL_ORDER: readonly AgentLevel[] = ['simple', 'medium', 'complex'];

export function levelLabel(level: AgentLevel | null | undefined): string | null {
  return LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? null;
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
  /** Cómo se muestra el agente (ej. «David»); sin él, su nombre técnico. */
  displayName?: string | null;
  /** Su imagen (data URL); sin ella, la app dibuja un avatar. */
  avatar?: string | null;
  /** Esfuerzo con que trabaja; sin él, el del modelo. */
  effort?: AgentEffort | null;
  /** Solo desarrolladores: el tamaño de ticket que les toca. */
  level?: AgentLevel | null;
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
  displayName?: string | null;
  avatar?: string | null;
  effort?: AgentEffort | null;
  level?: AgentLevel | null;
}

/** Cómo se llama el agente en pantalla: su nombre para mostrar o, si no tiene, el técnico. */
export function agentLabel(agent: Pick<Agent, 'name' | 'displayName'>): string {
  return agent.displayName?.trim() || agent.name;
}

/**
 * Herramientas que el backend permite a un agente de cada módulo (de solo lectura, salvo el
 * desarrollador de la ejecución de tareas, que además edita archivos y corre pruebas, y el
 * revisor, que corre pruebas, lint y build sin editar).
 * Espejo de `MODULE_TOOLS` en workbench-server; si el backend rechaza otra, devuelve un 400
 * con la lista real.
 */
export const MODULE_TOOLS: Record<AgentModule, readonly string[]> = {
  'pr-review': ['Read', 'Grep', 'Glob', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)'],
  planner: ['Read', 'Grep', 'Glob', 'Bash(git log:*)', 'Bash(git show:*)'],
  'task-chat': ['Read', 'Grep', 'Glob', 'Bash(git log:*)', 'Bash(git show:*)'],
  chat: ['Read', 'Grep', 'Glob', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)'],
  'task-tickets': ['Read', 'Grep', 'Glob', 'Bash(git log:*)', 'Bash(git show:*)'],
  // prettier-ignore
  'task-developer': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git restore:*)', 'Bash(git checkout --:*)', 'Bash(git rm:*)', 'Bash(cp:*)','Bash(npm install:*)', 'Bash(npm i:*)', 'Bash(npm ci:*)', 'Bash(npm test:*)', 'Bash(npm run test:*)', 'Bash(npm run lint:*)', 'Bash(npm run build:*)'],
  // prettier-ignore
  'task-reviewer': ['Read', 'Grep', 'Glob', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(npm test:*)', 'Bash(npm run test:*)', 'Bash(npm run lint:*)', 'Bash(npm run build:*)'],
};
