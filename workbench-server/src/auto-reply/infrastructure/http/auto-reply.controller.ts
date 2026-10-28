import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { SlackApiClient } from '@core/slack/slack-api.client';
import { AutoReplyService } from '@auto-reply/application/auto-reply.service';
import {
  IncomingMessage,
  IncomingMessagesService,
} from '@auto-reply/application/incoming-messages.service';
import {
  AutoReplySettings,
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
} from '@auto-reply/domain/auto-reply-settings';
import {
  AutoReplyResponseDto,
  UpdateAutoReplyDto,
} from '@auto-reply/dto/auto-reply.dto';
import { AutoReplyScheduler } from '@auto-reply/infrastructure/scheduling/auto-reply.scheduler';

@Controller('auto-reply')
export class AutoReplyController {
  constructor(
    private readonly autoReply: AutoReplyService,
    private readonly incoming: IncomingMessagesService,
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

  /** Mira ahora, sin esperar al reloj. */
  @Post('check')
  check(): Promise<IncomingMessage[]> {
    return this.incoming.check();
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
}
