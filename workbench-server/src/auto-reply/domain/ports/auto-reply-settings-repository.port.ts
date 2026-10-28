import { AutoReplySettings } from '../auto-reply-settings';

export interface AutoReplySettingsRepositoryPort {
  /** Los ajustes (hay uno solo); si nunca se guardaron, los de fábrica. */
  get(): Promise<AutoReplySettings>;
  save(settings: AutoReplySettings): Promise<AutoReplySettings>;
}

export const AUTO_REPLY_SETTINGS_REPOSITORY_PORT = Symbol(
  'AUTO_REPLY_SETTINGS_REPOSITORY_PORT',
);
