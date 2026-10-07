import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '@ai-agents/domain/entities/agent.entity';
import {
  AgentModule,
  DEFAULT_MODULE,
  isAgentModule,
} from '@ai-agents/domain/modules';
import { DEFAULT_PROVIDER, isAgentProvider } from '@ai-agents/domain/providers';
import { AgentRepositoryPort } from '@ai-agents/domain/ports/agent-repository.port';
import { AgentOrmEntity } from '@ai-agents/infrastructure/persistence/agent.orm-entity';

@Injectable()
export class TypeOrmAgentRepository implements AgentRepositoryPort {
  constructor(
    @InjectRepository(AgentOrmEntity)
    private readonly agentRepository: Repository<AgentOrmEntity>,
  ) {}

  async findById(id: string): Promise<Agent | null> {
    const orm = await this.agentRepository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByName(name: string): Promise<Agent | null> {
    const orm = await this.agentRepository.findOne({ where: { name } });
    return orm ? this.toDomain(orm) : null;
  }

  async findDefault(module: AgentModule): Promise<Agent | null> {
    const orm = await this.agentRepository.findOne({
      where: { is_default: true, module },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findAll(module?: AgentModule): Promise<Agent[]> {
    const rows = await this.agentRepository.find({
      where: module ? { module } : {},
      order: { name: 'ASC' },
    });
    return rows.map((orm) => this.toDomain(orm));
  }

  async save(agent: Agent): Promise<Agent> {
    const saved = await this.agentRepository.save({
      id: agent.id,
      name: agent.name,
      system_prompt: agent.systemPrompt,
      module: agent.module,
      provider: agent.provider,
      model: agent.model,
      allowed_tools: agent.allowedTools,
      is_default: agent.isDefault,
      created_at: agent.createdAt,
      updated_at: agent.updatedAt,
    });
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.agentRepository.delete(id);
  }

  async clearDefault(module: AgentModule): Promise<void> {
    await this.agentRepository.update(
      { is_default: true, module },
      { is_default: false },
    );
  }

  private toDomain(orm: AgentOrmEntity): Agent {
    return Agent.reconstruct({
      id: orm.id,
      name: orm.name,
      systemPrompt: orm.system_prompt,
      module: isAgentModule(orm.module) ? orm.module : DEFAULT_MODULE,
      provider: isAgentProvider(orm.provider) ? orm.provider : DEFAULT_PROVIDER,
      model: orm.model,
      allowedTools: orm.allowed_tools,
      isDefault: orm.is_default,
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }
}
