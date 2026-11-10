import { AiCallUsage } from '@ai-agents/domain/ai-call';
import { Agent } from '@ai-agents/domain/entities/agent.entity';

export interface AgentRunInput {
  agent: Agent;
  /** Contexto de la tarea; lo arma quien llama. */
  prompt: string;
  /** Directorio donde el agente puede leer. */
  workdir: string;
  /** Modelo a usar; si falta se usa el del agente. */
  model?: string;
  /** Si el CLI informa lo que gastó la llamada, lo avisa aquí (los que no lo informan no lo llaman). */
  onUsage?: (usage: AiCallUsage) => void;
}

export interface AgentRunnerPort {
  run(input: AgentRunInput): Promise<string>;
}

export const AGENT_RUNNER_PORT = Symbol('AGENT_RUNNER_PORT');
