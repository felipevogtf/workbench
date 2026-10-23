import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_MESSAGE_CHARS } from '@pr-review/application/chat-prompt';

/** Tope de mensajes que acepta una petición (la conversación completa viaja en cada una). */
const MAX_MESSAGES = 100;

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_CHARS)
  content!: string;
}

export class ChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

export class ChatReplyDto {
  reply!: string;
  agentName!: string;
  model!: string;
  commit!: string;
}
