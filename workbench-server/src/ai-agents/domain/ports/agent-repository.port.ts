import { Agent } from '@ai-agents/domain/entities/agent.entity';
import { AgentModule } from '@ai-agents/domain/modules';

export interface AgentRepositoryPort {
  findById(id: string): Promise<Agent | null>;
  findByName(name: string): Promise<Agent | null>;
  findDefault(module: AgentModule): Promise<Agent | null>;
  findAll(module?: AgentModule): Promise<Agent[]>;
  save(agent: Agent): Promise<Agent>;
  delete(id: string): Promise<void>;
  /** Desmarca el agente por defecto de un módulo (los demás módulos no se tocan). */
  clearDefault(module: AgentModule): Promise<void>;
}

export const AGENT_REPOSITORY_PORT = Symbol('AGENT_REPOSITORY_PORT');
