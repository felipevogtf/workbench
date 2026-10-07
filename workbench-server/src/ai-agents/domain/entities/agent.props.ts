import { AgentProvider } from '@ai-agents/domain/providers';

export interface AgentProps {
  id: string;
  name: string;
  systemPrompt: string;
  provider: AgentProvider;
  model: string;
  allowedTools: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
