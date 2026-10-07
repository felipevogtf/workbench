/** CLIs de IA con los que puede correr un agente. */
export const AGENT_PROVIDERS = ['claude', 'copilot', 'antigravity'] as const;

export type AgentProvider = (typeof AGENT_PROVIDERS)[number];

export const DEFAULT_PROVIDER: AgentProvider = 'claude';

export function isAgentProvider(value: string): value is AgentProvider {
  return (AGENT_PROVIDERS as readonly string[]).includes(value);
}

export interface ProviderInfo {
  id: AgentProvider;
  label: string;
  /** Modelos que se ofrecen al elegir este proveedor. */
  models: readonly string[];
  /** Se controla con la variable de entorno `AGENT_PROVIDERS`. */
  enabled: boolean;
}
