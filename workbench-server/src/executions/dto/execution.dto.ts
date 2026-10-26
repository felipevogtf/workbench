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
import type { ChatProposal } from '@executions/domain/chat-proposals';
import {
  ExecutionRepo,
  ExecutionStatus,
  ExecutionTarget,
  ExecutionTicket,
  FinalReview,
  StageRun,
  TICKET_LEVELS,
} from '@executions/domain/entities/execution.props';
import { BRANCH_TYPES, type BranchType } from '@executions/domain/repo';
import { JobKind, JobStatus } from '@executions/domain/entities/job.props';
import type { ExecutionUsage } from '@executions/application/usage.service';

export class JobSummaryDto {
  id!: string;
  kind!: JobKind;
  ticketId!: string | null;
  status!: JobStatus;
  attempt!: number;
  costUsd!: number | null;
  error!: string | null;
  runnerId!: string | null;
  /** El agente que hizo (o hará) el trabajo; `null` en los que no usan uno (subir la rama). */
  agentId!: string | null;
  /** Su nombre técnico: los trabajos anteriores a que se guardara el id solo se reconocen por él. */
  agentName!: string | null;
  /** Lo que respondió el desarrollador al terminar (su resumen); solo en los trabajos de desarrollo. */
  output!: string | null;
  /** El veredicto del revisor; solo en los trabajos de revisión ya terminados. */
  review!: { approved: boolean; summary: string; issues: string[] } | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  /** Tokens que gastó (entrada, salida y caché); `null` en los trabajos anteriores a medirlo. */
  tokens!: number | null;
}

export class ExecutionResponseDto {
  id!: string;
  issueId!: string;
  repo!: ExecutionRepo;
  branch!: string;
  baseBranch!: string | null;
  /** Todos los repositorios de la tarea (el primero igual que arriba), cada uno con su rama y su PR. */
  repos!: ExecutionTarget[];
  status!: ExecutionStatus;
  stages!: StageRun[];
  tickets!: ExecutionTicket[];
  pullRequestUrl!: string | null;
  error!: string | null;
  /** La revisión final que pidió el usuario, si la pidió. */
  finalReview!: FinalReview | null;
  createdAt!: string;
  updatedAt!: string;
  finishedAt!: string | null;
}

/** Una ejecución en el historial general: con el nombre de su tarea. */
export class ExecutionListItemDto extends ExecutionResponseDto {
  issueName!: string | null;
}

export class ExecutionDetailDto extends ExecutionResponseDto {
  jobs!: JobSummaryDto[];
  /** Hay trabajo en cola y ningún runner conectado para hacerlo. */
  waitingForRunner!: boolean;
  /** Costo total de los trabajos que ya informaron el suyo. */
  costUsd!: number;
  /** Lo que gastó la ejecución: tokens exactos y lo que costó del plan (medido y estimado). */
  usage!: ExecutionUsage;
}

export class JobLogsDto {
  logs!: string;
  status!: JobStatus;
}

/** Cambia quién desarrolla o revisa un ticket. */
export class AssignTicketDto {
  @IsOptional()
  @IsUUID()
  developerId?: string;

  @IsOptional()
  @IsUUID()
  reviewerId?: string;
}

/** La respuesta del usuario a la pregunta de un desarrollador. */
export class AnswerQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4_000)
  text!: string;
}

/** Largo máximo de un mensaje del chat (el mismo tope que los demás chats). */
const MAX_CHAT_MESSAGE_CHARS = 30_000;
/** Tope de mensajes que acepta una petición (la conversación completa viaja en cada una). */
const MAX_CHAT_MESSAGES = 100;

export class ExecutionChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CHAT_MESSAGE_CHARS)
  content!: string;
}

export class ExecutionChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CHAT_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => ExecutionChatMessageDto)
  messages!: ExecutionChatMessageDto[];
}

export class ExecutionChatReplyDto {
  reply!: string;
  agentName!: string;
  model!: string;
  /** Lo que Lucy propone y el usuario puede confirmar: notas, tickets nuevos o la revisión final. */
  proposals!: ChatProposal[];
}

/** Cómo se ejecuta una tarea; todo es opcional. */
export class StartExecutionDto {
  /** Cómo empieza la rama (`feature/…`, `fix/…`, `hotfix/…`); sin esto se deduce del nombre de la tarea. */
  @IsOptional()
  @IsIn(BRANCH_TYPES)
  branchType?: BranchType;
}

/** Un ticket nuevo para sumar a una ejecución terminada. */
export class NewTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4_000)
  description!: string;

  @IsOptional()
  @IsIn(TICKET_LEVELS)
  level?: (typeof TICKET_LEVELS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  criteria?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  files?: string[];

  /** `organización/repo`, cuando la tarea tiene varios. */
  @IsOptional()
  @IsString()
  repo?: string;
}

export class AddTicketsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => NewTicketDto)
  tickets!: NewTicketDto[];
}

/** Una instrucción del usuario para quien trabaje el ticket la próxima vez. */
export class AddNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  text!: string;
}
