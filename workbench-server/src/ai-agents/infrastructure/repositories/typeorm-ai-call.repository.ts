import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AiCall } from '@ai-agents/domain/ai-call';
import { AiCallRepositoryPort } from '@ai-agents/domain/ports/ai-call-repository.port';
import { AiCallOrmEntity } from '@ai-agents/infrastructure/persistence/ai-call.orm-entity';

@Injectable()
export class TypeOrmAiCallRepository implements AiCallRepositoryPort {
  constructor(
    @InjectRepository(AiCallOrmEntity)
    private readonly repository: Repository<AiCallOrmEntity>,
  ) {}

  async save(call: AiCall): Promise<void> {
    await this.repository.save({
      id: call.id,
      at: call.at,
      module: call.module,
      agent_id: call.agentId,
      agent_name: call.agentName,
      model: call.model,
      input_tokens: call.tokens.input,
      output_tokens: call.tokens.output,
      cache_write_tokens: call.tokens.cacheWrite,
      cache_read_tokens: call.tokens.cacheRead,
      cost_usd: call.costUsd,
    });
  }

  async findSince(since: Date): Promise<AiCall[]> {
    const rows = await this.repository.find({
      where: { at: MoreThanOrEqual(since) },
      order: { at: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      at: row.at,
      module: row.module,
      agentId: row.agent_id,
      agentName: row.agent_name,
      model: row.model,
      tokens: {
        input: row.input_tokens,
        output: row.output_tokens,
        cacheWrite: row.cache_write_tokens,
        cacheRead: row.cache_read_tokens,
      },
      costUsd: row.cost_usd,
    }));
  }
}
