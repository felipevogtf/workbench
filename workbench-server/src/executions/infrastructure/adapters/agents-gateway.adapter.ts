import { Injectable } from '@nestjs/common';
import { AgentsService } from '@ai-agents/application/agents.service';
import {
  AgentsGatewayPort,
  ExecutionAgentModule,
  ResolvedAgent,
} from '@executions/domain/ports/gateways.port';

/** Único punto de la ejecución que conoce al módulo ai-agents. */
@Injectable()
export class AgentsGatewayAdapter implements AgentsGatewayPort {
  constructor(private readonly agents: AgentsService) {}

  async getDefault(module: ExecutionAgentModule): Promise<ResolvedAgent> {
    const agent = await this.agents.getDefault(module);
    return {
      name: agent.name,
      provider: agent.provider,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      allowedTools: [...agent.allowedTools],
    };
  }
}
