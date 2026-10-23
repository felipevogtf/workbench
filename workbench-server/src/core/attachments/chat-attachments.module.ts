import { Module } from '@nestjs/common';
import { ChatAttachmentsController } from './chat-attachments.controller';
import { ChatAttachmentsService } from './chat-attachments.service';

/** Los adjuntos del chat: la subida (un endpoint) y el servicio que los deja a la vista del agente. */
@Module({
  controllers: [ChatAttachmentsController],
  providers: [ChatAttachmentsService],
  exports: [ChatAttachmentsService],
})
export class ChatAttachmentsModule {}
