import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Agent } from '@ai-agents/domain/entities/agent.entity';
import { AgentsService } from '@ai-agents/application/agents.service';
import {
  AgentChatReply,
  AgentsGatewayPort,
  ExecutionAgentModule,
  ResolvedAgent,
} from '@executions/domain/ports/gateways.port';

/** Único punto de la ejecución que conoce al módulo ai-agents. */
@Injectable()
export class AgentsGatewayAdapter implements AgentsGatewayPort {
  constructor(private readonly agents: AgentsService) {}

  async getDefault(module: ExecutionAgentModule): Promise<ResolvedAgent> {
    return this.resolve(await this.agents.getDefault(module));
  }

  async listByModule(module: ExecutionAgentModule): Promise<ResolvedAgent[]> {
    const all = await this.agents.findAll(module);
    return all
      .map((agent) => this.resolve(agent))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  async getById(id: string): Promise<ResolvedAgent | null> {
    return this.agents.findById(id).then(
      (agent) => this.resolve(agent),
      () => null,
    );
  }

  async chat(request: {
    prompt: string;
    workdir?: string;
  }): Promise<AgentChatReply> {
    // Sin repos que leer, Lucy trabaja en una carpeta vacía: el estado de la ejecución va en el prompt.
    const temp = request.workdir
      ? null
      : await mkdtemp(join(tmpdir(), 'wb-exec-chat-'));
    try {
      const result = await this.agents.run({
        module: 'task-tickets',
        prompt: request.prompt,
        workdir: request.workdir ?? temp ?? '',
      });
      return {
        reply: result.output,
        agentName: result.agentName,
        model: result.model,
      };
    } finally {
      if (temp) await rm(temp, { recursive: true, force: true });
    }
  }

  private resolve(agent: Agent): ResolvedAgent {
    return {
      id: agent.id,
      name: agent.name,
      displayName: agent.displayName,
      provider: agent.provider,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      allowedTools: [...agent.allowedTools],
      effort: agent.effort,
      level: agent.level,
      isDefault: agent.isDefault,
    };
  }
}
