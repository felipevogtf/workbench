import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ChatReply } from '../models/chat';
import { PullRequestChatStore } from './pull-request-chat.store';
import { PullRequestsApi } from './pull-requests.api';

const reply = (text: string): ChatReply => ({
  reply: text,
  agentName: 'default-chat',
  model: 'claude-sonnet-5-5',
  commit: 'abc12345',
});

describe('PullRequestChatStore', () => {
  let api: { chat: ReturnType<typeof vi.fn> };
  let store: PullRequestChatStore;

  beforeEach(() => {
    localStorage.clear();
    api = { chat: vi.fn(() => of(reply('Hace X.'))) };
    TestBed.configureTestingModule({
      providers: [PullRequestChatStore, { provide: PullRequestsApi, useValue: api }],
    });
    store = TestBed.inject(PullRequestChatStore);
    store.bind('p1');
  });

  it('sends the whole conversation and adds the answer of the assistant', async () => {
    await store.send('  Qué hace esto?  ');
    await store.send('Y esto otro?');

    expect(api.chat).toHaveBeenLastCalledWith(
      'p1',
      [
        { role: 'user', content: 'Qué hace esto?' },
        { role: 'assistant', content: 'Hace X.' },
        { role: 'user', content: 'Y esto otro?' },
      ],
      undefined,
    );
    expect(store.messages().map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(store.sending()).toBe(false);
  });

  it('sends the file the user has open with every question', async () => {
    store.setContext({ path: 'src/a.ts', status: 'modified' });

    await store.send('Qué hace esto?');
    store.setContext({ path: 'src/b.ts', status: 'renamed', oldPath: 'src/old.ts' });
    await store.send('Y este?');

    expect(api.chat.mock.calls[0][2]).toEqual({ path: 'src/a.ts', status: 'modified' });
    expect(api.chat.mock.calls[1][2]).toEqual({
      path: 'src/b.ts',
      status: 'renamed',
      oldPath: 'src/old.ts',
    });
  });

  it('sends no file when none is open', async () => {
    store.setContext({ path: 'src/a.ts', status: 'modified' });
    store.setContext(null);

    await store.send('hola');

    expect(api.chat.mock.calls[0][2]).toBeUndefined();
  });

  it('ignores an empty message and does not send while it is waiting for an answer', async () => {
    const pending = new Subject<ChatReply>();
    api.chat.mockReturnValue(pending);

    await store.send('   ');
    const first = store.send('primera');
    await store.send('segunda');

    expect(api.chat).toHaveBeenCalledTimes(1);
    expect(store.sending()).toBe(true);

    pending.next(reply('ok'));
    pending.complete();
    await first;
    expect(store.messages()).toHaveLength(2);
  });

  it('keeps the question when the answer fails, and lets the user try again', async () => {
    api.chat.mockReturnValueOnce(throwError(() => new Error('boom')));

    await store.send('Qué hace esto?');

    expect(store.error()).toBeTruthy();
    expect(store.canRetry()).toBe(true);
    expect(store.messages()).toEqual([{ role: 'user', content: 'Qué hace esto?' }]);

    await store.retry();

    expect(store.error()).toBeNull();
    expect(store.canRetry()).toBe(false);
    expect(store.messages().map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('opens the chat when it is asked something from outside', async () => {
    expect(store.open()).toBe(false);

    await store.ask('Explícame este segmento');

    expect(store.open()).toBe(true);
    expect(store.messages()[0].content).toBe('Explícame este segmento');
  });

  it('keeps one conversation per pull request in the browser', async () => {
    await store.send('hola');

    store.bind('p2');
    expect(store.messages()).toEqual([]);

    store.bind('p1');
    expect(store.messages().map((m) => m.content)).toEqual(['hola', 'Hace X.']);
  });

  it('restores the conversation of a pull request in a new session', async () => {
    await store.send('hola');

    const fresh = TestBed.runInInjectionContext(() => new PullRequestChatStore());
    fresh.bind('p1');

    expect(fresh.messages().map((m) => m.content)).toEqual(['hola', 'Hace X.']);
  });

  it('forgets the conversation when it is cleared', async () => {
    await store.send('hola');

    store.clear();

    expect(store.messages()).toEqual([]);
    expect(localStorage.getItem('workbench.chat.pr.p1')).toBeNull();
  });

  it('drops an answer that arrives after moving to another pull request', async () => {
    const pending = new Subject<ChatReply>();
    api.chat.mockReturnValue(pending);

    const sending = store.send('hola');
    store.bind('p2');
    pending.next(reply('tarde'));
    pending.complete();
    await sending;

    expect(store.messages()).toEqual([]);
    store.bind('p1');
    expect(store.messages().map((m) => m.role)).toEqual(['user']);
  });

  it('survives a corrupt or unavailable storage', () => {
    localStorage.setItem('workbench.chat.pr.p3', '{not json');

    store.bind('p3');

    expect(store.messages()).toEqual([]);
  });
});
