import { Injectable } from '@nestjs/common';
import {
  AgentRunInput,
  AgentRunnerPort,
} from '@ai-agents/domain/ports/agent-runner.port';
import { AgentProvider } from '@ai-agents/domain/providers';
import { AntigravityCliAgentRunnerAdapter } from './antigravity-cli-agent-runner.adapter';
import { ClaudeCliAgentRunnerAdapter } from './claude-cli-agent-runner.adapter';
import { CopilotCliAgentRunnerAdapter } from './copilot-cli-agent-runner.adapter';

/** Entrega cada ejecución al CLI del proveedor del agente. */
@Injectable()
export class AgentRunnerRouterAdapter implements AgentRunnerPort {
  private readonly runners: Record<AgentProvider, AgentRunnerPort>;

  constructor(
    claude: ClaudeCliAgentRunnerAdapter,
    copilot: CopilotCliAgentRunnerAdapter,
    antigravity: AntigravityCliAgentRunnerAdapter,
  ) {
    this.runners = { claude, copilot, antigravity };
  }

  run(input: AgentRunInput): Promise<string> {
    return this.runners[input.agent.provider].run(input);
  }
}
