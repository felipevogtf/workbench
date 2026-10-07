import { AgentModule } from '@ai-agents/domain/modules';
import { AgentProvider } from '@ai-agents/domain/providers';

export interface AgentProps {
  id: string;
  name: string;
  systemPrompt: string;
  module: AgentModule;
  provider: AgentProvider;
  model: string;
  allowedTools: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
