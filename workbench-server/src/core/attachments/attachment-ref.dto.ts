import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_ATTACHMENTS_PER_MESSAGE } from './attachments';

/** Un adjunto referenciado por un mensaje del chat. */
export class AttachmentRefDto {
  @IsUUID()
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}

/**
 * Los adjuntos (opcionales) de un mensaje. Los dos chats (PRs y tareas) lo usan igual, así que viven
 * juntos: `@AttachmentRefs() attachments?: AttachmentRefDto[]`.
 */
export const AttachmentRefs = () =>
  applyDecorators(
    IsOptional(),
    IsArray(),
    ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE),
    ValidateNested({ each: true }),
    Type(() => AttachmentRefDto),
  );
