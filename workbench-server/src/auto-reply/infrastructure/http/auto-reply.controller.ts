import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { SlackApiClient } from '@core/slack/slack-api.client';
import { AutoReplyService } from '@auto-reply/application/auto-reply.service';
import {
  IncomingMessage,
  IncomingMessagesService,
} from '@auto-reply/application/incoming-messages.service';
import { RepliesService } from '@auto-reply/application/replies.service';
import {
  AutoReplySettings,
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
} from '@auto-reply/domain/auto-reply-settings';
import { ReplyDraft } from '@auto-reply/domain/reply-draft';
import {
  AutoReplyResponseDto,
  ReplyDraftResponseDto,
  SendDraftDto,
  UpdateAutoReplyDto,
} from '@auto-reply/dto/auto-reply.dto';
import { AutoReplyScheduler } from '@auto-reply/infrastructure/scheduling/auto-reply.scheduler';

@Controller('auto-reply')
export class AutoReplyController {
  constructor(
    private readonly autoReply: AutoReplyService,
    private readonly incoming: IncomingMessagesService,
    private readonly replies: RepliesService,
    private readonly scheduler: AutoReplyScheduler,
    private readonly slack: SlackApiClient,
  ) {}

  @Get()
  async get(): Promise<AutoReplyResponseDto> {
    return this.toDto(await this.autoReply.get());
  }

  @Put()
  async update(@Body() dto: UpdateAutoReplyDto): Promise<AutoReplyResponseDto> {
    const settings = await this.autoReply.update(dto);
    this.scheduler.reschedule();
    return this.toDto(settings);
  }

  /** Lo último que se encontró de los contactos. Sirve para ver que la lectura funciona. */
  @Get('inbox')
  inbox(): readonly IncomingMessage[] {
    return this.incoming.inbox();
  }

  /** Mira ahora, sin esperar al reloj, y atiende lo que encuentre. */
  @Post('check')
  check(): Promise<IncomingMessage[]> {
    return this.replies.run();
  }

  /** Las respuestas redactadas (pendientes, enviadas, escaladas…), las más nuevas primero. */
  @Get('drafts')
  async drafts(): Promise<ReplyDraftResponseDto[]> {
    return (await this.replies.list()).map((draft) => this.draftDto(draft));
  }

  /** Envía el borrador, con los mensajes del agente o con los que Felipe corrigió. */
  @Post('drafts/:id/send')
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendDraftDto,
  ): Promise<ReplyDraftResponseDto> {
    return this.draftDto(await this.replies.send(id, dto.replies));
  }

  @Post('drafts/:id/discard')
  async discard(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReplyDraftResponseDto> {
    return this.draftDto(await this.replies.discard(id));
  }

  private toDto(settings: AutoReplySettings): AutoReplyResponseDto {
    return {
      enabled: settings.enabled,
      intervalSeconds: settings.intervalSeconds,
      mode: settings.mode,
      contacts: settings.contacts.map((contact) => ({ ...contact })),
      slackConfigured: this.slack.isEnabled(),
      minIntervalSeconds: MIN_INTERVAL_SECONDS,
      maxIntervalSeconds: MAX_INTERVAL_SECONDS,
    };
  }

  private draftDto(draft: ReplyDraft): ReplyDraftResponseDto {
    return {
      id: draft.id,
      contactId: draft.contactId,
      contactName: draft.contactName,
      incoming: draft.incoming.map((line) => ({ ...line })),
      action: draft.action,
      replies: [...draft.replies],
      reason: draft.reason,
      status: draft.status,
      error: draft.error,
      createdAt: draft.createdAt,
      sentAt: draft.sentAt,
    };
  }
}
