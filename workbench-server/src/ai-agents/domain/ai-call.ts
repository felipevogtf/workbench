/** Lo que gastó una llamada a la IA hecha desde el servidor (planificador, chats, revisión de PR…). */
export interface AiCallUsage {
  tokens: {
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
  };
  /** Costo a precio de lista, en dólares; 0 si el CLI no lo informó. */
  costUsd: number;
}

/** Una llamada ya hecha, guardada para mostrar el consumo. */
export interface AiCall extends AiCallUsage {
  id: string;
  at: Date;
  /** El módulo que llamó: `planner`, `task-chat`, `task-tickets`… */
  module: string;
  agentId: string | null;
  agentName: string | null;
  model: string | null;
}
