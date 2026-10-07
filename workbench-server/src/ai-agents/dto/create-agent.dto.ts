import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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
}
