import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentsModule } from '@ai-agents/ai-agents.module';
import { SlackApiClient } from '@core/slack/slack-api.client';
import { AutoReplyService } from './application/auto-reply.service';
import { IncomingMessagesService } from './application/incoming-messages.service';
import { RepliesService } from './application/replies.service';
import { AUTO_REPLY_SETTINGS_REPOSITORY_PORT } from './domain/ports/auto-reply-settings-repository.port';
import { REPLY_DRAFT_REPOSITORY_PORT } from './domain/ports/reply-draft-repository.port';
import { REPLY_WRITER_PORT } from './domain/ports/reply-writer.port';
import { AgentReplyWriterAdapter } from './infrastructure/adapters/agent-reply-writer.adapter';
import { AutoReplyController } from './infrastructure/http/auto-reply.controller';
import { AutoReplySettingsOrmEntity } from './infrastructure/persistence/auto-reply-settings.orm-entity';
import { ReplyDraftOrmEntity } from './infrastructure/persistence/reply-draft.orm-entity';
import { TypeOrmAutoReplySettingsRepository } from './infrastructure/repositories/typeorm-auto-reply-settings.repository';
import { TypeOrmReplyDraftRepository } from './infrastructure/repositories/typeorm-reply-draft.repository';
import { AutoReplyScheduler } from './infrastructure/scheduling/auto-reply.scheduler';

@Module({
  imports: [
    HttpModule,
    AiAgentsModule,
    TypeOrmModule.forFeature([AutoReplySettingsOrmEntity, ReplyDraftOrmEntity]),
  ],
  controllers: [AutoReplyController],
  providers: [
    SlackApiClient,
    AutoReplyService,
    IncomingMessagesService,
    RepliesService,
    AutoReplyScheduler,
    { provide: REPLY_WRITER_PORT, useClass: AgentReplyWriterAdapter },
    {
      provide: REPLY_DRAFT_REPOSITORY_PORT,
      useClass: TypeOrmReplyDraftRepository,
    },
    {
      provide: AUTO_REPLY_SETTINGS_REPOSITORY_PORT,
      useClass: TypeOrmAutoReplySettingsRepository,
    },
  ],
})
export class AutoReplyModule {}
