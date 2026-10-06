import { Injectable } from '@nestjs/common';
import { AgentsService } from '@ai-agents/application/agents.service';
import {
  AgentsGatewayPort,
  ReviewRunRequest,
  ReviewRunResult,
} from '@pr-review/domain/ports/agents-gateway.port';

/** Único punto de pr-review que conoce al módulo ai-agents. */
@Injectable()
export class AgentsGatewayAdapter implements AgentsGatewayPort {
  constructor(private readonly agentsService: AgentsService) {}

  async runReview(request: ReviewRunRequest): Promise<ReviewRunResult> {
    const result = await this.agentsService.run({
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
