import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentOrmEntity } from './infrastructure/persistence/agent.orm-entity';
import { AgentsController } from './infrastructure/http/agents.controller';
import { AgentsService } from './application/agents.service';
import { AGENT_REPOSITORY_PORT } from './domain/ports/agent-repository.port';
import { TypeOrmAgentRepository } from './infrastructure/repositories/typeorm-agent.repository';
import { AGENT_RUNNER_PORT } from './domain/ports/agent-runner.port';
import { AgentProvidersService } from './application/agent-providers.service';
import { AgentProvidersController } from './infrastructure/http/agent-providers.controller';
import { AgentProviderSettingOrmEntity } from './infrastructure/persistence/agent-provider-setting.orm-entity';
import { TypeOrmProviderSettingsRepository } from './infrastructure/repositories/typeorm-provider-settings.repository';
import { PROVIDER_SETTINGS_REPOSITORY_PORT } from './domain/ports/provider-settings-repository.port';
import { PROVIDER_CATALOG_PORT } from './domain/ports/provider-catalog.port';
import { EnvProviderCatalogAdapter } from './infrastructure/adapters/env-provider-catalog.adapter';
import { AgentRunnerRouterAdapter } from './infrastructure/adapters/agent-runner-router.adapter';
import { CopilotCliAgentRunnerAdapter } from './infrastructure/adapters/copilot-cli-agent-runner.adapter';
import { AntigravityCliAgentRunnerAdapter } from './infrastructure/adapters/antigravity-cli-agent-runner.adapter';
import { ClaudeCliAgentRunnerAdapter } from './infrastructure/adapters/claude-cli-agent-runner.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentOrmEntity, AgentProviderSettingOrmEntity]),
  ],
  controllers: [AgentsController, AgentProvidersController],
  providers: [
    AgentsService,
    { provide: AGENT_REPOSITORY_PORT, useClass: TypeOrmAgentRepository },
    AgentProvidersService,
    {
      provide: PROVIDER_SETTINGS_REPOSITORY_PORT,
      useClass: TypeOrmProviderSettingsRepository,
    },
    { provide: PROVIDER_CATALOG_PORT, useClass: EnvProviderCatalogAdapter },
    ClaudeCliAgentRunnerAdapter,
    CopilotCliAgentRunnerAdapter,
    AntigravityCliAgentRunnerAdapter,
    { provide: AGENT_RUNNER_PORT, useClass: AgentRunnerRouterAdapter },
  ],
  exports: [AgentsService],
})
export class AiAgentsModule {}
