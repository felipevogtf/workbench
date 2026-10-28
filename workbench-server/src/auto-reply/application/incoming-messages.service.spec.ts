import { SlackApiClient } from '@core/slack/slack-api.client';
import { AutoReplySettings } from '@auto-reply/domain/auto-reply-settings';
import { AutoReplySettingsRepositoryPort } from '@auto-reply/domain/ports/auto-reply-settings-repository.port';
import { IncomingMessagesService } from './incoming-messages.service';

const ME = 'UME';
const OSCAR = 'UOSCAR';

function build(options: {
  history: unknown[];
  enabled?: boolean;
  lastSeenTs?: string | null;
}) {
  let settings = AutoReplySettings.defaults();
  settings.update({
    enabled: true,
    contacts: [{ userId: OSCAR, name: 'Oscar' }],
  });
  if (options.lastSeenTs !== null) {
    settings.markSeen(OSCAR, options.lastSeenTs ?? '100.000000');
  }

  const calls: [string, Record<string, string>][] = [];
  const slack = {
    isEnabled: () => options.enabled ?? true,
    call: jest.fn((method: string, params: Record<string, string>) => {
      calls.push([method, params]);
      if (method === 'auth.test') return Promise.resolve({ user_id: ME });
      if (method === 'conversations.open') {
        return Promise.resolve({ channel: { id: 'D1' } });
      }
      return Promise.resolve({ messages: options.history });
    }),
  } as unknown as SlackApiClient;
  const repository: AutoReplySettingsRepositoryPort = {
    get: () => Promise.resolve(settings),
    save: (next) => {
      settings = next;
      return Promise.resolve(next);
    },
  };
  const service = new IncomingMessagesService(slack, repository);
  return { service, calls, settings: () => settings };
}

describe('IncomingMessagesService', () => {
  it('returns what the contact wrote since the last look, oldest first', async () => {
    const { service, calls } = build({
      history: [
        { ts: '103.000000', user: OSCAR, text: 'oe' },
        { ts: '102.000000', user: OSCAR, text: 'felipin' },
        { ts: '90.000000', user: OSCAR, text: 'muy viejo' },
      ],
    });

    const found = await service.check();

    expect(found.map((message) => message.text)).toEqual(['felipin', 'oe']);
    expect(
      calls.find(([method]) => method === 'conversations.history')?.[1],
    ).toMatchObject({ channel: 'D1', oldest: '100.000000' });
  });

  it('remembers the newest message so it is not returned twice', async () => {
    const { service, settings } = build({
      history: [{ ts: '102.000000', user: OSCAR, text: 'hola' }],
    });

    await service.check();

    expect(settings().contacts[0].lastSeenTs).toBe('102.000000');
  });

  it('marks as answered what the user already replied to', async () => {
    const { service } = build({
      history: [
        { ts: '101.000000', user: OSCAR, text: 'revisa esto' },
        { ts: '102.000000', user: ME, text: 'ya voy' },
        { ts: '103.000000', user: OSCAR, text: 'gracias' },
      ],
    });

    const found = await service.check();

    expect(found.map((m) => [m.text, m.repliedByMe])).toEqual([
      ['revisa esto', true],
      ['gracias', false],
    ]);
  });

  it('ignores system messages and empty ones', async () => {
    const { service } = build({
      history: [
        { ts: '101.000000', user: OSCAR, subtype: 'channel_join', text: 'x' },
        { ts: '102.000000', user: OSCAR, text: '   ' },
      ],
    });

    expect(await service.check()).toEqual([]);
  });

  it('only marks "from now" the first time, without reading old messages', async () => {
    const { service, calls, settings } = build({
      history: [{ ts: '5.000000', user: OSCAR, text: 'de hace tiempo' }],
      lastSeenTs: null,
    });

    expect(await service.check()).toEqual([]);

    expect(calls).toEqual([]);
    expect(Number(settings().contacts[0].lastSeenTs)).toBeGreaterThan(1e9);
  });

  it('keeps the latest findings in the inbox, newest first', async () => {
    const { service } = build({
      history: [
        { ts: '101.000000', user: OSCAR, text: 'uno' },
        { ts: '102.000000', user: OSCAR, text: 'dos' },
      ],
    });

    await service.check();

    expect(service.inbox().map((message) => message.text)).toEqual([
      'dos',
      'uno',
    ]);
  });

  it('fails clearly without a Slack session', async () => {
    const { service } = build({ history: [], enabled: false });

    await expect(service.check()).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('shares one pass when asked twice at the same time', async () => {
    const { service, calls } = build({ history: [] });

    await Promise.all([service.check(), service.check()]);

    expect(
      calls.filter(([method]) => method === 'conversations.open'),
    ).toHaveLength(1);
  });
});
