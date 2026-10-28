import { Inject, Injectable } from '@nestjs/common';
import {
  AutoReplyMode,
  AutoReplySettings,
} from '@auto-reply/domain/auto-reply-settings';
import { AUTO_REPLY_SETTINGS_REPOSITORY_PORT } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';
import type { AutoReplySettingsRepositoryPort } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';

@Injectable()
export class AutoReplyService {
  constructor(
    @Inject(AUTO_REPLY_SETTINGS_REPOSITORY_PORT)
    private readonly settings: AutoReplySettingsRepositoryPort,
  ) {}

  get(): Promise<AutoReplySettings> {
    return this.settings.get();
  }

  async update(changes: {
    enabled?: boolean;
    intervalSeconds?: number;
    mode?: AutoReplyMode;
    contacts?: { userId: string; name: string }[];
  }): Promise<AutoReplySettings> {
    const settings = await this.settings.get();
    settings.update(changes);
    return this.settings.save(settings);
  }
}
