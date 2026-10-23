import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DomainError } from '@core/domain/domain.error';
import { MAX_ATTACHMENT_BYTES } from './attachments';
import {
  ChatAttachmentsService,
  type SavedAttachment,
  type UploadedFile as UploadedFileData,
} from './chat-attachments.service';

@Controller('chat/attachments')
export class ChatAttachmentsController {
  constructor(private readonly attachments: ChatAttachmentsService) {}

  /**
   * Sube un archivo para adjuntarlo a un mensaje del chat (campo `file`). Devuelve su id, con el que el
   * mensaje lo referencia. Se pasa del tamaño máximo: 413; de un tipo no aceptado o vacío: 400.
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  upload(@UploadedFile() file?: UploadedFileData): Promise<SavedAttachment> {
    if (!file) {
      throw new DomainError('Falta el archivo (campo «file»).');
    }
    return this.attachments.save(file);
  }
}
