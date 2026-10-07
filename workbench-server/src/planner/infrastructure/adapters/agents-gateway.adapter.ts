import { Injectable } from '@nestjs/common';
import { AgentsService } from '@ai-agents/application/agents.service';
import {
  AgentsGatewayPort,
  PlanRunRequest,
  PlanRunResult,
} from '@planner/domain/ports/agents-gateway.port';

/** Único punto del planificador que conoce al módulo ai-agents. */
@Injectable()
export class AgentsGatewayAdapter implements AgentsGatewayPort {
  constructor(private readonly agentsService: AgentsService) {}

  async runPlan(request: PlanRunRequest): Promise<PlanRunResult> {
    const result = await this.agentsService.run({
      module: 'planner',
      agentId: request.agentId,
      model: request.model,
      prompt: request.prompt,
      workdir: request.workdir,
    });

    return {
      markdown: result.output,
      agentId: result.agentId,
      agentName: result.agentName,
      model: result.model,
    };
  }
}
