import { AgentModule } from '@ai-agents/domain/modules';
import { AgentProvider } from '@ai-agents/domain/providers';

export class CreateAgentDto {
  name!: string;
  systemPrompt!: string;
  module?: AgentModule;
  provider?: AgentProvider;
  model!: string;
  allowedTools?: string[];
  isDefault?: boolean;
}
