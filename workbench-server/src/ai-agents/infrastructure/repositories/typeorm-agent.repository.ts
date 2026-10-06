import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '@ai-agents/domain/entities/agent.entity';
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

  async findDefault(): Promise<Agent | null> {
    const orm = await this.agentRepository.findOne({
      where: { is_default: true },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findAll(): Promise<Agent[]> {
    const rows = await this.agentRepository.find({ order: { name: 'ASC' } });
    return rows.map((orm) => this.toDomain(orm));
  }

  async save(agent: Agent): Promise<Agent> {
    const saved = await this.agentRepository.save({
      id: agent.id,
      name: agent.name,
      system_prompt: agent.systemPrompt,
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

  async clearDefault(): Promise<void> {
    await this.agentRepository.update(
      { is_default: true },
      { is_default: false },
    );
  }

  private toDomain(orm: AgentOrmEntity): Agent {
    return Agent.reconstruct({
      id: orm.id,
      name: orm.name,
      systemPrompt: orm.system_prompt,
      model: orm.model,
      allowedTools: orm.allowed_tools,
      isDefault: orm.is_default,
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }
}
