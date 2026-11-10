import { Injectable } from '@nestjs/common';
import { AgentsService } from '@ai-agents/application/agents.service';
import {
  AiCallsGatewayPort,
  ServerAiCall,
} from '@executions/domain/ports/gateways.port';

/** Único punto del consumo que conoce las llamadas a la IA del módulo ai-agents. */
@Injectable()
export class AiCallsGatewayAdapter implements AiCallsGatewayPort {
  constructor(private readonly agents: AgentsService) {}

  async since(date: Date): Promise<ServerAiCall[]> {
    return this.agents.callsSince(date);
  }
}
