import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentOrmEntity } from './infrastructure/persistence/agent.orm-entity';
import { AgentsController } from './infrastructure/http/agents.controller';
import { AgentsService } from './application/agents.service';
import { AGENT_REPOSITORY_PORT } from './domain/ports/agent-repository.port';
import { TypeOrmAgentRepository } from './infrastructure/repositories/typeorm-agent.repository';
import { AGENT_RUNNER_PORT } from './domain/ports/agent-runner.port';
import { ClaudeCliAgentRunnerAdapter } from './infrastructure/adapters/claude-cli-agent-runner.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([AgentOrmEntity])],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    { provide: AGENT_REPOSITORY_PORT, useClass: TypeOrmAgentRepository },
    { provide: AGENT_RUNNER_PORT, useClass: ClaudeCliAgentRunnerAdapter },
  ],
  exports: [AgentsService],
})
export class AiAgentsModule {}
