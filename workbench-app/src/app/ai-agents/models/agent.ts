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

/** Los módulos de los trabajadores: los agentes que ejecutan una tarea (menú «Trabajadores»). */
export const WORKER_MODULES: readonly AgentModule[] = [
  'task-tickets',
  'task-developer',
  'task-reviewer',
];

/**
 * Qué agentes muestra una pantalla: los de siempre («Agentes de IA») o los de la automatización
 * («Trabajadores»). Las dos usan las mismas páginas; la ruta dice cuál.
 */
export type AgentScope = 'general' | 'workers';

/** Dónde vive cada menú de agentes (para volver y navegar tras guardar). */
export const SCOPE_BASE: Record<AgentScope, string> = {
  general: '/agents',
  workers: '/executions/agents',
};

export function modulesOf(scope: AgentScope): readonly { value: AgentModule; label: string }[] {
  return MODULE_OPTIONS.filter(
    (option) => WORKER_MODULES.includes(option.value) === (scope === 'workers'),
  );
}

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
 * Herramientas que el backend permite a un agente de cada módulo (de solo lectura, salvo el
 * desarrollador de la ejecución de tareas, que además edita archivos y corre pruebas).
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
  'task-developer': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git restore:*)', 'Bash(git checkout --:*)', 'Bash(npm install:*)', 'Bash(npm i:*)', 'Bash(npm ci:*)', 'Bash(npm test:*)', 'Bash(npm run test:*)', 'Bash(npm run lint:*)', 'Bash(npm run build:*)'],
  // prettier-ignore
  'task-reviewer': ['Read', 'Grep', 'Glob', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)'],
};
