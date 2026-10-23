import { ChatAttachmentsApi } from '@core/api/chat-attachments.api';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TaskChatReply } from '../models/plan';
import { TaskChatStore } from './task-chat.store';
import { TasksApi } from './tasks.api';

const reply = (text: string): TaskChatReply => ({
  reply: text,
  agentName: 'default-task-chat',
  model: 'm',
  tickets: [],
  hasPlan: true,
});

describe('TaskChatStore', () => {
  let api: { chatTask: ReturnType<typeof vi.fn> };
  let store: TaskChatStore;

  beforeEach(() => {
    localStorage.clear();
    api = { chatTask: vi.fn(() => of(reply('Cambiaría el paso 2.'))) };
    TestBed.configureTestingModule({
      providers: [
        TaskChatStore,
        { provide: TasksApi, useValue: api },
        { provide: ChatAttachmentsApi, useValue: { upload: vi.fn() } },
      ],
    });
    store = TestBed.inject(TaskChatStore);
    store.bind('i1');
  });

  it('sends the whole conversation of the task and adds the answer of the assistant', async () => {
    await store.send('¿Qué pasa con el paso 2?');
    await store.send('Y si lo quitamos?');

    expect(api.chatTask).toHaveBeenLastCalledWith('i1', [
      { role: 'user', content: '¿Qué pasa con el paso 2?' },
      { role: 'assistant', content: 'Cambiaría el paso 2.' },
      { role: 'user', content: 'Y si lo quitamos?' },
    ]);
    expect(store.messages().map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('keeps one conversation per task in the browser', async () => {
    await store.send('hola');

    store.bind('i2');
    expect(store.messages()).toEqual([]);

    store.bind('i1');
    expect(store.messages().map((m) => m.content)).toEqual(['hola', 'Cambiaría el paso 2.']);
    expect(localStorage.getItem('workbench.chat.task.i1')).toContain('hola');
  });

  it('keeps the question when the answer fails, and lets the user try again', async () => {
    api.chatTask.mockReturnValueOnce(throwError(() => new Error('boom')));

    await store.send('hola');

    expect(store.error()).toBeTruthy();
    expect(store.canRetry()).toBe(true);

    await store.retry();

    expect(store.error()).toBeNull();
    expect(store.messages().map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('gives the conversation as it is sent to the server, cutting what is too long', () => {
    store.bind('i3');
    void store.send('x'.repeat(40_000));

    expect(store.snapshot()[0].content).toHaveLength(30_000);
  });
});
