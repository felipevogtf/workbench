import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderSettingsRepositoryPort } from '@ai-agents/domain/ports/provider-settings-repository.port';
import { AgentProvider, isAgentProvider } from '@ai-agents/domain/providers';
import { AgentProviderSettingOrmEntity } from '@ai-agents/infrastructure/persistence/agent-provider-setting.orm-entity';

@Injectable()
export class TypeOrmProviderSettingsRepository implements ProviderSettingsRepositoryPort {
  constructor(
    @InjectRepository(AgentProviderSettingOrmEntity)
    private readonly repository: Repository<AgentProviderSettingOrmEntity>,
  ) {}

  async findDisabled(): Promise<AgentProvider[]> {
    const rows = await this.repository.find({ where: { enabled: false } });
    return rows.map((row) => row.provider).filter(isAgentProvider);
  }

  async setEnabled(provider: AgentProvider, enabled: boolean): Promise<void> {
    await this.repository.save({ provider, enabled });
  }
}
