/** Cuánto se esfuerza el modelo al trabajar (lo que `claude --effort` acepta). */
export const AGENT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type AgentEffort = (typeof AGENT_EFFORTS)[number];

/** Para qué tamaño de ticket sirve un desarrollador. */
export const AGENT_LEVELS = ['simple', 'medium', 'complex'] as const;
export type AgentLevel = (typeof AGENT_LEVELS)[number];
