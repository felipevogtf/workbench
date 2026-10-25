import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  AGENT_EFFORTS,
  AGENT_LEVELS,
  type AgentEffort,
  type AgentLevel,
} from '@ai-agents/domain/effort';
import { AGENT_MODULES, type AgentModule } from '@ai-agents/domain/modules';
import {
  AGENT_PROVIDERS,
  type AgentProvider,
} from '@ai-agents/domain/providers';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  systemPrompt!: string;

  @IsOptional()
  @IsIn(AGENT_MODULES)
  module?: AgentModule;

  @IsOptional()
  @IsIn(AGENT_PROVIDERS)
  provider?: AgentProvider;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTools?: string[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  /** Nombre con que se muestra al agente (ej. «David»). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string | null;

  /** Imagen del agente como data URL; tope de ~400 KB. */
  @IsOptional()
  @IsString()
  @MaxLength(400_000)
  avatar?: string | null;

  /** Esfuerzo con que trabaja; vacío = el del modelo. */
  @IsOptional()
  @IsIn([...AGENT_EFFORTS, null, ''])
  effort?: AgentEffort | null;

  /** Solo desarrolladores: el tamaño de ticket que les toca. */
  @IsOptional()
  @IsIn([...AGENT_LEVELS, null, ''])
  level?: AgentLevel | null;
}
