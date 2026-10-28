import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlackApiClient } from '@core/slack/slack-api.client';
import { AutoReplyService } from './application/auto-reply.service';
import { IncomingMessagesService } from './application/incoming-messages.service';
import { AUTO_REPLY_SETTINGS_REPOSITORY_PORT } from './domain/ports/auto-reply-settings-repository.port';
import { AutoReplyController } from './infrastructure/http/auto-reply.controller';
import { AutoReplySettingsOrmEntity } from './infrastructure/persistence/auto-reply-settings.orm-entity';
import { TypeOrmAutoReplySettingsRepository } from './infrastructure/repositories/typeorm-auto-reply-settings.repository';
import { AutoReplyScheduler } from './infrastructure/scheduling/auto-reply.scheduler';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([AutoReplySettingsOrmEntity])],
  controllers: [AutoReplyController],
  providers: [
    SlackApiClient,
    AutoReplyService,
    IncomingMessagesService,
    AutoReplyScheduler,
    {
      provide: AUTO_REPLY_SETTINGS_REPOSITORY_PORT,
      useClass: TypeOrmAutoReplySettingsRepository,
    },
  ],
})
export class AutoReplyModule {}
