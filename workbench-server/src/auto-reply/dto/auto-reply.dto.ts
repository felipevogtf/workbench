import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { AutoReplyMode } from '@auto-reply/domain/auto-reply-settings';
import { MAX_REPLIES, MAX_REPLY_LENGTH } from '@auto-reply/domain/reply-draft';
import {
  AUTO_REPLY_MODES,
  MAX_CONTACTS,
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
} from '@auto-reply/domain/auto-reply-settings';

export class ContactDto {
  @IsString()
  @Matches(/^[UW][A-Z0-9]+$/, { message: 'userId must be a Slack user id' })
  userId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateAutoReplyDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(MIN_INTERVAL_SECONDS)
  @Max(MAX_INTERVAL_SECONDS)
  intervalSeconds?: number;

  @IsOptional()
  @IsIn(AUTO_REPLY_MODES)
  mode?: AutoReplyMode;

  @IsOptional()
  @ArrayMaxSize(MAX_CONTACTS)
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts?: ContactDto[];
}

export class AutoReplyContactResponseDto {
  userId!: string;
  name!: string;
  lastSeenTs!: string | null;
}

export class AutoReplyResponseDto {
  enabled!: boolean;
  intervalSeconds!: number;
  mode!: AutoReplyMode;
  contacts!: AutoReplyContactResponseDto[];
  /** Si el servidor tiene la sesión de Slack: sin ella no se puede mirar ni responder. */
  slackConfigured!: boolean;
  minIntervalSeconds!: number;
  maxIntervalSeconds!: number;
}

export class SendDraftDto {
  /** Los mensajes que Felipe corrigió; si no viene, salen los que redactó el agente. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REPLIES)
  @IsString({ each: true })
  @MaxLength(MAX_REPLY_LENGTH, { each: true })
  replies?: string[];
}

export class ReplyDraftResponseDto {
  id!: string;
  contactId!: string;
  contactName!: string;
  incoming!: { ts: string; text: string }[];
  action!: 'reply' | 'escalate';
  replies!: string[];
  reason!: string | null;
  status!: 'pending' | 'sent' | 'discarded' | 'escalated' | 'failed';
  error!: string | null;
  createdAt!: Date;
  sentAt!: Date | null;
}
