/**
 * Módulos de la app que usan agentes de IA. Cada agente pertenece a uno y cada módulo tiene su
 * propio agente por defecto. Sumar un módulo es agregar un valor aquí (y su lista de herramientas).
 */
export const AGENT_MODULES = [
  'pr-review',
  'planner',
  'chat',
  'task-chat',
  'task-tickets',
  'task-developer',
  'task-reviewer',
] as const;

export type AgentModule = (typeof AGENT_MODULES)[number];

export const DEFAULT_MODULE: AgentModule = 'pr-review';

export function isAgentModule(value: string): value is AgentModule {
  return (AGENT_MODULES as readonly string[]).includes(value);
}

/**
 * Herramientas que un agente de cada módulo puede usar. Son listas cerradas y de solo lectura: el
 * agente corre sobre código y textos ajenos que pueden contener instrucciones maliciosas (prompt
 * injection), así que no puede escribir ni ejecutar comandos arbitrarios.
 */
export const MODULE_TOOLS: Record<AgentModule, readonly string[]> = {
  'pr-review': [
    'Read',
    'Grep',
    'Glob',
    'Bash(git diff:*)',
    'Bash(git log:*)',
    'Bash(git show:*)',
  ],
  planner: ['Read', 'Grep', 'Glob', 'Bash(git log:*)', 'Bash(git show:*)'],
  // El chat de una tarea ayuda a afinar su plan: lee el código de sus repos para verificarlo.
  'task-chat': ['Read', 'Grep', 'Glob', 'Bash(git log:*)', 'Bash(git show:*)'],
  // Los agentes de la ejecución de tareas corren en el PC del usuario (runner), no en el servidor. El
  // runner además recorta esta lista con la suya: nunca usa más de lo que esta le permite.
  'task-tickets': [
    'Read',
    'Grep',
    'Glob',
    'Bash(git log:*)',
    'Bash(git show:*)',
  ],
  // Escribe código, pero no hace commit ni push: de eso se encarga el runner.
  'task-developer': [
    'Read',
    'Grep',
    'Glob',
    'Edit',
    'Write',
    'Bash(git status:*)',
    'Bash(git diff:*)',
    'Bash(git log:*)',
    'Bash(npm install:*)',
    'Bash(npm i:*)',
    'Bash(npm ci:*)',
    'Bash(npm test:*)',
    'Bash(npm run test:*)',
    'Bash(npm run lint:*)',
    'Bash(npm run build:*)',
  ],
  'task-reviewer': [
    'Read',
    'Grep',
    'Glob',
    'Bash(git diff:*)',
    'Bash(git log:*)',
    'Bash(git show:*)',
  ],
  // El chat conversa sobre el código de una PR: puede leerlo y comparar ramas, nada más.
  chat: [
    'Read',
    'Grep',
    'Glob',
    'Bash(git diff:*)',
    'Bash(git log:*)',
    'Bash(git show:*)',
  ],
};
