/**
 * Módulos de la app que usan agentes de IA. Cada agente pertenece a uno y cada módulo tiene su
 * propio agente por defecto. Sumar un módulo es agregar un valor aquí (y su lista de herramientas).
 */
export const AGENT_MODULES = ['pr-review', 'planner'] as const;

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
};
