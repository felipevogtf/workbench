import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { SlackApiClient } from '@core/slack/slack-api.client';
import { AutoReplySettings } from '@auto-reply/domain/auto-reply-settings';
import { AUTO_REPLY_SETTINGS_REPOSITORY_PORT } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';
import type { AutoReplySettingsRepositoryPort } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';

const HISTORY_PAGE = '100';
const KEPT_IN_INBOX = 50;

/** Un mensaje que un contacto le escribió al usuario y que aún no se ha atendido. */
export interface IncomingMessage {
  contactId: string;
  contactName: string;
  /** `ts` de Slack: identifica el mensaje y lo ordena. */
  ts: string;
  text: string;
  /** El usuario ya escribió en la conversación después de este mensaje: no hace falta responder por él. */
  repliedByMe: boolean;
  seenAt: string;
}

interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  subtype?: string;
}

/**
 * Mira las conversaciones directas de los contactos del modo «no molestar» y devuelve lo que escribieron desde la última
 * vez. Solo lee: no responde nada.
 */
@Injectable()
export class IncomingMessagesService {
  private readonly logger = new Logger(IncomingMessagesService.name);
  private selfId: string | null = null;
  private readonly channels = new Map<string, string>();
  private recent: IncomingMessage[] = [];
  private running: Promise<IncomingMessage[]> | null = null;

  constructor(
    private readonly slack: SlackApiClient,
    @Inject(AUTO_REPLY_SETTINGS_REPOSITORY_PORT)
    private readonly settings: AutoReplySettingsRepositoryPort,
  ) {}

  isEnabled(): boolean {
    return this.slack.isEnabled();
  }

  /** Lo último que se encontró, del más nuevo al más viejo. */
  inbox(): readonly IncomingMessage[] {
    return this.recent;
  }

  /** Una pasada sobre todos los contactos. Si ya hay una en curso, devuelve la misma en vez de lanzar otra. */
  check(): Promise<IncomingMessage[]> {
    this.running ??= this.pass().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async pass(): Promise<IncomingMessage[]> {
    if (!this.slack.isEnabled()) {
      throw DomainError.conflict(
        'Slack is not configured (SLACK_XOXC_TOKEN and SLACK_XOXD_COOKIE)',
      );
    }
    const settings = await this.settings.get();
    const found: IncomingMessage[] = [];
    let changed = false;

    for (const contact of settings.contacts) {
      try {
        const before = contact.lastSeenTs;
        found.push(...(await this.lookAt(settings, contact.userId)));
        const after = settings.contacts.find(
          (known) => known.userId === contact.userId,
        )?.lastSeenTs;
        if (after !== before) changed = true;
      } catch (error) {
        this.logger.warn(
          `Could not read the conversation with ${contact.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (changed) await this.settings.save(settings);
    if (found.length > 0) {
      this.recent = [...[...found].reverse(), ...this.recent].slice(
        0,
        KEPT_IN_INBOX,
      );
    }
    return found;
  }

  private async lookAt(
    settings: AutoReplySettings,
    userId: string,
  ): Promise<IncomingMessage[]> {
    const contact = settings.contacts.find((known) => known.userId === userId)!;

    // La primera vez solo se marca «desde ahora»: lo que ya estaba escrito no se atiende.
    if (!contact.lastSeenTs) {
      settings.markSeen(userId, `${Math.floor(Date.now() / 1000)}.000000`);
      return [];
    }
    const since = contact.lastSeenTs;

    const channel = await this.channelOf(userId);
    const out = await this.slack.call('conversations.history', {
      channel,
      oldest: since,
      limit: HISTORY_PAGE,
    });
    const messages = [...((out.messages as SlackMessage[] | undefined) ?? [])]
      .filter((message) => Number(message.ts) > Number(since))
      .sort((a, b) => Number(a.ts) - Number(b.ts));
    if (messages.length === 0) return [];

    settings.markSeen(userId, messages[messages.length - 1].ts);

    const me = await this.myId();
    const lastOfMine = Math.max(
      0,
      ...messages
        .filter((message) => message.user === me)
        .map((message) => Number(message.ts)),
    );
    const seenAt = new Date().toISOString();
    return messages
      .filter(
        (message) =>
          message.user === userId && !message.subtype && message.text?.trim(),
      )
      .map((message) => ({
        contactId: userId,
        contactName: contact.name,
        ts: message.ts,
        text: message.text!,
        repliedByMe: lastOfMine > Number(message.ts),
        seenAt,
      }));
  }

  private async channelOf(userId: string): Promise<string> {
    const known = this.channels.get(userId);
    if (known) return known;
    const opened = await this.slack.call('conversations.open', {
      users: userId,
    });
    const id = (opened.channel as { id: string }).id;
    this.channels.set(userId, id);
    return id;
  }

  private async myId(): Promise<string> {
    this.selfId ??= (await this.slack.call('auth.test', {})).user_id as string;
    return this.selfId;
  }
}
