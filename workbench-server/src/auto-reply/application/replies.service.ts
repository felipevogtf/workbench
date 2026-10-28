import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { extractJson } from '@executions/domain/json-output';
import { AUTO_REPLY_SETTINGS_REPOSITORY_PORT } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';
import type { AutoReplySettingsRepositoryPort } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';
import { REPLY_DRAFT_REPOSITORY_PORT } from '@auto-reply/domain/ports/reply-draft-repository.port';
import type { ReplyDraftRepositoryPort } from '@auto-reply/domain/ports/reply-draft-repository.port';
import { REPLY_WRITER_PORT } from '@auto-reply/domain/ports/reply-writer.port';
import type { ReplyWriterPort } from '@auto-reply/domain/ports/reply-writer.port';
import { IncomingLine, ReplyDraft } from '@auto-reply/domain/reply-draft';
import {
  IncomingMessage,
  IncomingMessagesService,
} from './incoming-messages.service';

const CONTEXT_MESSAGES = 15;
const LIST_LIMIT = 50;

interface Decision {
  action: 'reply' | 'escalate';
  messages: string[];
  reason: string | null;
}

/**
 * Responde, con el estilo de Felipe, a lo que sus contactos le escriben mientras no quiere que lo molesten. En modo
 * `draft` deja la respuesta para que él la apruebe; en `auto` la envía sola. Lo que no le toca al agente lo deja para él.
 */
@Injectable()
export class RepliesService {
  private readonly logger = new Logger(RepliesService.name);

  constructor(
    private readonly incoming: IncomingMessagesService,
    @Inject(AUTO_REPLY_SETTINGS_REPOSITORY_PORT)
    private readonly settings: AutoReplySettingsRepositoryPort,
    @Inject(REPLY_DRAFT_REPOSITORY_PORT)
    private readonly drafts: ReplyDraftRepositoryPort,
    @Inject(REPLY_WRITER_PORT)
    private readonly writer: ReplyWriterPort,
  ) {}

  list(): Promise<ReplyDraft[]> {
    return this.drafts.findRecent(LIST_LIMIT);
  }

  /** Mira los mensajes nuevos y atiende los que Felipe no respondió. Devuelve lo que encontró. */
  async run(): Promise<IncomingMessage[]> {
    const found = await this.incoming.check();
    const pending = found.filter((message) => !message.repliedByMe);
    const byContact = new Map<string, IncomingMessage[]>();
    for (const message of pending) {
      byContact.set(message.contactId, [
        ...(byContact.get(message.contactId) ?? []),
        message,
      ]);
    }
    for (const messages of byContact.values()) {
      await this.attend(messages);
    }
    return found;
  }

  /** Manda lo redactado (o lo que Felipe corrigió) y deja el borrador como enviado. */
  async send(id: string, edited?: readonly string[]): Promise<ReplyDraft> {
    const draft = await this.get(id);
    const replies = draft.repliesToSend(edited);
    try {
      for (const reply of replies) {
        await this.incoming.say(draft.contactId, reply);
      }
    } catch (error) {
      draft.markFailed(error instanceof Error ? error.message : String(error));
      await this.drafts.save(draft);
      throw error;
    }
    draft.markSent(replies);
    return this.drafts.save(draft);
  }

  async discard(id: string): Promise<ReplyDraft> {
    const draft = await this.get(id);
    draft.discard();
    return this.drafts.save(draft);
  }

  private async get(id: string): Promise<ReplyDraft> {
    const draft = await this.drafts.findById(id);
    if (!draft) throw DomainError.notFound(`Draft ${id} not found`);
    return draft;
  }

  private async attend(messages: IncomingMessage[]): Promise<void> {
    const { contactId, contactName } = messages[0];
    const lines: IncomingLine[] = messages.map(({ ts, text }) => ({
      ts,
      text,
    }));
    const channelId = await this.incoming.channelFor(contactId);

    try {
      const decision = await this.decide(contactId, contactName, lines);
      let draft = await this.drafts.save(
        ReplyDraft.create({
          contactId,
          contactName,
          channelId,
          incoming: lines,
          action: decision.action,
          replies: decision.messages,
          reason: decision.reason,
        }),
      );
      if (draft.status !== 'pending') return;

      const settings = await this.settings.get();
      if (settings.mode === 'auto' && (await this.stillUnanswered(draft))) {
        draft = await this.send(draft.id);
        this.logger.log(`Replied to ${contactName} on its own`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not attend ${contactName}: ${message}`);
      await this.drafts.save(
        ReplyDraft.failed({
          contactId,
          contactName,
          channelId,
          incoming: lines,
          error: message,
        }),
      );
    }
  }

  /** Antes de responder solo: si Felipe escribió en el entretiempo, ya no hace falta y se deja como borrador. */
  private async stillUnanswered(draft: ReplyDraft): Promise<boolean> {
    const last = draft.incoming[draft.incoming.length - 1];
    const conversation = await this.incoming.conversationWith(
      draft.contactId,
      CONTEXT_MESSAGES,
    );
    return !conversation.some(
      (message) => message.fromMe && Number(message.ts) > Number(last.ts),
    );
  }

  private async decide(
    contactId: string,
    contactName: string,
    lines: IncomingLine[],
  ): Promise<Decision> {
    const conversation = await this.incoming.conversationWith(
      contactId,
      CONTEXT_MESSAGES,
    );
    const output = await this.writer.write(
      buildPrompt(
        contactName,
        conversation,
        lines.map((line) => line.ts),
      ),
    );
    return parseDecision(output);
  }
}

function buildPrompt(
  contactName: string,
  conversation: { ts: string; fromMe: boolean; text: string }[],
  unanswered: string[],
): string {
  const lines = conversation.map(
    (message) =>
      `${unanswered.includes(message.ts) ? '> ' : '  '}${message.fromMe ? 'Felipe' : contactName}: ${message.text.replace(/\n+/g, ' / ')}`,
  );
  return [
    `Conversación directa de Slack entre Felipe y ${contactName}, de la más antigua a la más nueva.`,
    `Las líneas marcadas con ">" son los mensajes de ${contactName} que Felipe aún no responde.`,
    '',
    ...lines,
    '',
    `Responde como Felipe a lo que ${contactName} le escribió, según tus instrucciones, o escala si no te toca.`,
    'Solo el JSON.',
  ].join('\n');
}

function parseDecision(output: string): Decision {
  const data = extractJson(output) as {
    action?: unknown;
    messages?: unknown;
    reason?: unknown;
  };
  if (data.action === 'escalate') {
    return {
      action: 'escalate',
      messages: [],
      reason: typeof data.reason === 'string' ? data.reason : null,
    };
  }
  if (
    data.action === 'reply' &&
    Array.isArray(data.messages) &&
    data.messages.every((message) => typeof message === 'string')
  ) {
    return {
      action: 'reply',
      messages: data.messages,
      reason: null,
    };
  }
  throw new DomainError(
    'The agent did not answer with a reply or an escalation',
  );
}
