import { AutoReplySettings } from '@auto-reply/domain/auto-reply-settings';
import { AutoReplySettingsRepositoryPort } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';
import { ReplyDraftRepositoryPort } from '@auto-reply/domain/ports/reply-draft-repository.port';
import { ReplyWriterPort } from '@auto-reply/domain/ports/reply-writer.port';
import { ReplyDraft } from '@auto-reply/domain/reply-draft';
import {
  IncomingMessage,
  IncomingMessagesService,
} from './incoming-messages.service';
import { RepliesService } from './replies.service';

const OSCAR = 'UOSCAR';

function message(ts: string, text: string): IncomingMessage {
  return {
    contactId: OSCAR,
    contactName: 'Oscar Medina',
    ts,
    text,
    repliedByMe: false,
    seenAt: '2026-10-28T20:00:00.000Z',
  };
}

function build(options: {
  found: IncomingMessage[];
  agent?: string;
  mode?: 'draft' | 'auto';
  mineAfter?: boolean;
  context?: { ts: string; fromMe: boolean; text: string }[];
}) {
  const settings = AutoReplySettings.defaults();
  settings.update({ mode: options.mode ?? 'draft' });
  const saved = new Map<string, ReplyDraft>();
  const sent: string[] = [];
  const prompts: string[] = [];

  const incoming = {
    check: jest.fn(() => Promise.resolve(options.found)),
    channelFor: () => Promise.resolve('D1'),
    conversationWith: () =>
      Promise.resolve([
        ...(options.context ?? []),
        { ts: '100.1', fromMe: true, text: 'ya esta' },
        { ts: '101.0', fromMe: false, text: 'oe' },
        ...(options.mineAfter
          ? [{ ts: '102.0', fromMe: true, text: 'dime' }]
          : []),
      ]),
    say: jest.fn((_user: string, text: string) => {
      sent.push(text);
      return Promise.resolve();
    }),
  } as unknown as IncomingMessagesService;
  const settingsRepo: AutoReplySettingsRepositoryPort = {
    get: () => Promise.resolve(settings),
    save: (next) => Promise.resolve(next),
  };
  const drafts: ReplyDraftRepositoryPort = {
    save: (draft) => {
      saved.set(draft.id, draft);
      return Promise.resolve(draft);
    },
    findById: (id) => Promise.resolve(saved.get(id) ?? null),
    findRecent: () => Promise.resolve([...saved.values()]),
  };
  const write = jest.fn((prompt: string) => {
    prompts.push(prompt);
    return Promise.resolve(
      options.agent ?? '{"action":"reply","messages":["mande mande"]}',
    );
  });
  const writer: ReplyWriterPort = { write };
  const service = new RepliesService(incoming, settingsRepo, drafts, writer);
  return { service, saved, sent, prompts, write };
}

describe('RepliesService', () => {
  it('leaves a draft for Felipe to approve and sends nothing', async () => {
    const { service, saved, sent } = build({ found: [message('101.0', 'oe')] });

    await service.run();

    const [draft] = [...saved.values()];
    expect(draft).toMatchObject({
      status: 'pending',
      action: 'reply',
      contactName: 'Oscar Medina',
    });
    expect(draft.replies).toEqual(['mande mande']);
    expect(sent).toEqual([]);
  });

  it('gives the agent the conversation, marking what is unanswered', async () => {
    const { service, prompts } = build({ found: [message('101.0', 'oe')] });

    await service.run();

    expect(prompts[0]).toContain('Felipe: ya esta');
    expect(prompts[0]).toContain('> Oscar Medina: oe');
  });

  it.each([
    'quiero el felipe no ia',
    'eres un bot?',
    'estoy hablando con una inteligencia artificial?',
    'quiero hablar con el felipe real',
  ])(
    'does not answer, and does not even ask the agent, to "%s"',
    async (text) => {
      const { service, saved, write, sent } = build({
        found: [message('101.0', text)],
      });

      await service.run();

      const [draft] = [...saved.values()];
      expect(draft).toMatchObject({ status: 'escalated', action: 'escalate' });
      expect(draft.replies).toEqual([]);
      expect(write).not.toHaveBeenCalled();
      expect(sent).toEqual([]);
    },
  );

  it('does not answer while the conversation is about who is writing', async () => {
    const { service, saved, write, sent } = build({
      found: [message('101.0', 'ya lo perdimos')],
      context: [
        { ts: '99.0', fromMe: false, text: 'quiero el felipe no ia' },
        { ts: '99.5', fromMe: true, text: 'ahora soy 100% ia' },
      ],
    });

    await service.run();

    expect([...saved.values()][0]).toMatchObject({ status: 'escalated' });
    expect(write).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('leaves for Felipe what the agent says it should not answer', async () => {
    const { service, saved } = build({
      found: [message('101.0', 'apruebas el pase a prod?')],
      agent: '{"action":"escalate","reason":"pide una aprobación"}',
    });

    await service.run();

    const [draft] = [...saved.values()];
    expect(draft).toMatchObject({
      status: 'escalated',
      reason: 'pide una aprobación',
    });
  });

  it('ignores what Felipe already answered', async () => {
    const { service, saved } = build({
      found: [{ ...message('101.0', 'oe'), repliedByMe: true }],
    });

    await service.run();

    expect(saved.size).toBe(0);
  });

  it('groups several messages of the same contact in one draft', async () => {
    const { service, saved } = build({
      found: [message('101.0', 'oe'), message('101.5', 'estas?')],
    });

    await service.run();

    expect(saved.size).toBe(1);
    expect([...saved.values()][0].incoming.map((line) => line.text)).toEqual([
      'oe',
      'estas?',
    ]);
  });

  it('keeps a failed draft visible when the agent answers nonsense', async () => {
    const { service, saved } = build({
      found: [message('101.0', 'oe')],
      agent: 'Claro, con gusto te ayudo',
    });

    await service.run();

    expect([...saved.values()][0]).toMatchObject({ status: 'failed' });
  });

  it('sends on its own only in auto mode', async () => {
    const { service, saved, sent } = build({
      found: [message('101.0', 'oe')],
      mode: 'auto',
    });

    await service.run();

    expect(sent).toEqual(['mande mande']);
    expect([...saved.values()][0].status).toBe('sent');
  });

  it('does not answer on its own when Felipe wrote in between', async () => {
    const { service, saved, sent } = build({
      found: [message('101.0', 'oe')],
      mode: 'auto',
      mineAfter: true,
    });

    await service.run();

    expect(sent).toEqual([]);
    expect([...saved.values()][0].status).toBe('pending');
  });

  it('sends an approved draft, with the corrected messages when there are any', async () => {
    const { service, saved, sent } = build({ found: [message('101.0', 'oe')] });
    await service.run();
    const [draft] = [...saved.values()];

    const out = await service.send(draft.id, ['dale', 'ahi veo']);

    expect(sent).toEqual(['dale', 'ahi veo']);
    expect(out.status).toBe('sent');
    await expect(service.send(draft.id)).rejects.toMatchObject({
      kind: 'conflict',
    });
  });

  it('discards a pending draft', async () => {
    const { service, saved, sent } = build({ found: [message('101.0', 'oe')] });
    await service.run();
    const [draft] = [...saved.values()];

    expect((await service.discard(draft.id)).status).toBe('discarded');
    expect(sent).toEqual([]);
  });
});
