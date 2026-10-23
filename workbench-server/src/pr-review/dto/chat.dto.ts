import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  AttachmentRefDto,
  AttachmentRefs,
} from '@core/attachments/attachment-ref.dto';
import { MAX_MESSAGE_CHARS } from '@pr-review/application/chat-prompt';

/** Tope de mensajes que acepta una petición (la conversación completa viaja en cada una). */
const MAX_MESSAGES = 100;
const MAX_PATH_CHARS = 1024;

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_CHARS)
  content!: string;

  @AttachmentRefs()
  attachments?: AttachmentRefDto[];
}

/** El archivo que el usuario tiene abierto en el diff. */
export class ChatContextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PATH_CHARS)
  path!: string;

  @IsOptional()
  @IsIn(['added', 'deleted', 'modified', 'renamed'])
  status?: 'added' | 'deleted' | 'modified' | 'renamed';

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PATH_CHARS)
  oldPath?: string;
}

export class ChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatContextDto)
  context?: ChatContextDto;
}

export class ChatReplyDto {
  reply!: string;
  agentName!: string;
  model!: string;
  commit!: string;
}
