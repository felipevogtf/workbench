import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, of } from 'rxjs';
import {
  normalizeName,
  SlackReviewNotifierAdapter,
} from './slack-review-notifier.adapter';

const pullRequest = {
  provider: 'bitbucket' as const,
  repo: 'ws/app',
  externalId: '7',
  title: 'Arreglar login',
  author: 'José Pérez',
  url: 'https://bitbucket.org/ws/app/pull-requests/7',
};

type PostArgs = [string, string, { headers: Record<string, string> }];

function build(env: Record<string, string>, users: unknown[] = []) {
  const post = jest.fn<Observable<{ data: unknown }>, PostArgs>((url) => {
    const method = url.replace('https://slack.com/api/', '');
    const data: Record<string, unknown> = { ok: true };
    if (method === 'users.list') data.members = users;
    if (method === 'conversations.open') data.channel = { id: 'D1' };
    if (method === 'chat.postMessage') data.ts = '1.1';
    if (method === 'users.lookupByEmail') data.user = { id: 'U9' };
    return of({ data });
  });
  const adapter = new SlackReviewNotifierAdapter(
    { post } as unknown as HttpService,
    {
      get: (key: string) => env[key],
      getOrThrow: (key: string) => env[key],
    } as unknown as ConfigService,
  );
  return { adapter, post };
}

const CREDENTIALS = { SLACK_XOXC_TOKEN: 'xoxc-1', SLACK_XOXD_COOKIE: 'xoxd-1' };
const methods = (post: jest.Mock<unknown, PostArgs>) =>
  post.mock.calls.map(([url]) =>
    String(url).replace('https://slack.com/api/', ''),
  );

describe('SlackReviewNotifierAdapter', () => {
  it('does nothing without credentials', async () => {
    const { adapter, post } = build({});

    await adapter.notifyAuthor(pullRequest, '## Resumen');

    expect(post).not.toHaveBeenCalled();
  });

  it('does nothing with only one of the two credentials', async () => {
    const { adapter, post } = build({ SLACK_XOXC_TOKEN: 'xoxc-1' });

    await adapter.notifyAuthor(pullRequest, '## Resumen');

    expect(post).not.toHaveBeenCalled();
  });

  it('finds the author by exact name and posts the link and the review in a thread', async () => {
    const { adapter, post } = build(CREDENTIALS, [
      { id: 'U1', profile: { real_name: 'Jose Perez' } },
      { id: 'U2', profile: { real_name: 'Otra Persona' } },
    ]);

    await adapter.notifyAuthor(pullRequest, '## Resumen');

    expect(methods(post)).toEqual([
      'users.list',
      'conversations.open',
      'chat.postMessage',
      'chat.postMessage',
    ]);
    const header = new URLSearchParams(post.mock.calls[2][1]);
    expect(header.get('text')).toContain(
      '<https://bitbucket.org/ws/app/pull-requests/7|Arreglar login>',
    );
    const reply = new URLSearchParams(post.mock.calls[3][1]);
    expect(reply.get('thread_ts')).toBe('1.1');
    expect(reply.get('text')).toBe('*Resumen*');
    expect(post.mock.calls[0][2].headers.Cookie).toBe('d=xoxd-1');
  });

  it('does not guess when two people match the name', async () => {
    const { adapter, post } = build(CREDENTIALS, [
      { id: 'U1', profile: { real_name: 'Jose Perez' } },
      { id: 'U2', profile: { display_name: 'jose perez' } },
    ]);

    await adapter.notifyAuthor(pullRequest, '## Resumen');

    expect(methods(post)).toEqual(['users.list']);
  });

  it('uses SLACK_AUTHOR_MAP with a user id or an email', async () => {
    const byId = build({
      ...CREDENTIALS,
      SLACK_AUTHOR_MAP: '{"José Pérez":"U55"}',
    });
    await byId.adapter.notifyAuthor(pullRequest, 'x');
    expect(new URLSearchParams(byId.post.mock.calls[0][1]).get('users')).toBe(
      'U55',
    );

    const byEmail = build({
      ...CREDENTIALS,
      SLACK_AUTHOR_MAP: '{"José Pérez":"jose@example.com"}',
    });
    await byEmail.adapter.notifyAuthor(pullRequest, 'x');
    expect(methods(byEmail.post)[0]).toBe('users.lookupByEmail');
  });

  it('throws when Slack answers ok:false so the caller can log it', async () => {
    const { adapter, post } = build({
      ...CREDENTIALS,
      SLACK_AUTHOR_MAP: '{"José Pérez":"U55"}',
    });
    post.mockReturnValue(of({ data: { ok: false, error: 'invalid_auth' } }));

    await expect(adapter.notifyAuthor(pullRequest, 'x')).rejects.toThrow(
      'invalid_auth',
    );
  });
});

describe('normalizeName', () => {
  it('ignores case, accents and repeated spaces', () => {
    expect(normalizeName('  José   PÉREZ ')).toBe('jose perez');
  });
});
