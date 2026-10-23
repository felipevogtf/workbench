import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_CHAT_MESSAGE_CHARS } from '@planner/domain/conversation';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';

/** Tope de mensajes que acepta una petición (la conversación completa viaja en cada una). */
const MAX_MESSAGES = 100;

export class PlanChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CHAT_MESSAGE_CHARS)
  content!: string;
}

export class TaskChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => PlanChatMessageDto)
  messages!: PlanChatMessageDto[];
}

export class TaskChatReplyDto {
  reply!: string;
  agentName!: string;
  model!: string;
  /** Códigos de los tickets de Plane que se leyeron para contestar. */
  tickets!: string[];
  /** La tarea tenía un plan listo, que el agente tuvo a la vista. */
  hasPlan!: boolean;
}

export class CreatePlanDto {
  /** Opcional: un agente del módulo `planner` distinto del que está por defecto. */
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  /**
   * Replanificar: la conversación con la que se actualiza el último plan. Sin ella se genera un plan
   * normal, desde cero.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => PlanChatMessageDto)
  messages?: PlanChatMessageDto[];
}

export class PlanResponseDto {
  id!: string;
  issueId!: string;
  status!: string;
  agentName!: string | null;
  model!: string | null;
  repos!: PlanRepoInfo[];
  /** El plan del que parte, si se generó replanificando; null en un plan normal. */
  basedOnPlanId!: string | null;
  /** Se generó replanificando con una conversación (aunque no hubiera un plan anterior del que partir). */
  revised!: boolean;
  error!: string | null;
  /** Solo en el detalle de un plan; el historial no lo trae. */
  content?: string | null;
  createdAt!: string;
  updatedAt!: string;
}
