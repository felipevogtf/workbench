import { AgentProvider } from '@ai-agents/domain/providers';

export class CreateAgentDto {
  name!: string;
  systemPrompt!: string;
  provider?: AgentProvider;
  model!: string;
  allowedTools?: string[];
  isDefault?: boolean;
}
