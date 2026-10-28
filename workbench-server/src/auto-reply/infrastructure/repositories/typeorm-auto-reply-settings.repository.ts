import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AUTO_REPLY_MODES,
  AutoReplyMode,
  AutoReplySettings,
} from '@auto-reply/domain/auto-reply-settings';
import { AutoReplySettingsRepositoryPort } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';
import { AutoReplySettingsOrmEntity } from '@auto-reply/infrastructure/persistence/auto-reply-settings.orm-entity';

const ROW = 'default';

@Injectable()
export class TypeOrmAutoReplySettingsRepository implements AutoReplySettingsRepositoryPort {
  constructor(
    @InjectRepository(AutoReplySettingsOrmEntity)
    private readonly repository: Repository<AutoReplySettingsOrmEntity>,
  ) {}

  async get(): Promise<AutoReplySettings> {
    const orm = await this.repository.findOne({ where: { id: ROW } });
    if (!orm) return AutoReplySettings.defaults();
    const mode = AUTO_REPLY_MODES.includes(orm.mode as AutoReplyMode)
      ? (orm.mode as AutoReplyMode)
      : 'draft';
    return AutoReplySettings.reconstruct({
      enabled: orm.enabled,
      intervalSeconds: orm.interval_seconds,
      mode,
      contacts: orm.contacts ?? [],
    });
  }

  async save(settings: AutoReplySettings): Promise<AutoReplySettings> {
    await this.repository.save({
      id: ROW,
      enabled: settings.enabled,
      interval_seconds: settings.intervalSeconds,
      mode: settings.mode,
      contacts: settings.contacts.map((contact) => ({ ...contact })),
    });
    return this.get();
  }
}
