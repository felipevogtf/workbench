import { AgentEffort, AgentLevel } from '@ai-agents/domain/effort';
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
  /** Cómo se muestra al agente en la app (ej. «David»); `null` = su nombre técnico. */
  displayName: string | null;
  /** Esfuerzo con que trabaja; `null` = el que tenga el modelo por defecto. */
  effort: AgentEffort | null;
  /** Solo los desarrolladores: el tamaño de ticket que les toca; `null` = ninguno en especial. */
  level: AgentLevel | null;
  /** Imagen del agente (data URL); `null` = el avatar por defecto, que dibuja la app. */
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}
