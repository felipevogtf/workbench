import { Agent } from '@ai-agents/domain/entities/agent.entity';

export interface AgentRepositoryPort {
  findById(id: string): Promise<Agent | null>;
  findByName(name: string): Promise<Agent | null>;
  findDefault(): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  save(agent: Agent): Promise<Agent>;
  delete(id: string): Promise<void>;
  clearDefault(): Promise<void>;
}

export const AGENT_REPOSITORY_PORT = Symbol('AGENT_REPOSITORY_PORT');
