import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { PullRequestChatStore } from '../../data-access/pull-request-chat.store';
import { PullRequestsApi } from '../../data-access/pull-requests.api';
import { ChatReply } from '../../models/chat';
import { PrChat } from './pr-chat';

const reply = (text: string): ChatReply => ({
  reply: text,
  agentName: 'default-chat',
  model: 'claude-sonnet-5-5',
  commit: 'abc12345',
});

describe('PrChat', () => {
  let api: { chat: ReturnType<typeof vi.fn> };
  let store: PullRequestChatStore;

  beforeEach(() => {
    localStorage.clear();
    api = { chat: vi.fn(() => of(reply('Esto hace **X**.'))) };
    TestBed.configureTestingModule({
      providers: [PullRequestChatStore, { provide: PullRequestsApi, useValue: api }],
    });
    store = TestBed.inject(PullRequestChatStore);
    store.bind('p1');
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(PrChat);
    fixture.componentRef.setInput('context', 'ws/app #7');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('shows only the floating button until it is opened', async () => {
    const element = await render();

    expect(element.querySelector('.panel')).toBeNull();

    element.querySelector<HTMLButtonElement>('.fab')!.click();
    await settle();

    expect(element.querySelector('.panel')).not.toBeNull();
    expect(element.querySelector('.panel__context')?.textContent).toContain('ws/app #7');
    expect(element.querySelector('.panel__empty')).not.toBeNull();
  });

  it('sends what is typed with Enter and shows the answer as Markdown', async () => {
    store.toggle();
    const element = await render();
    const box = element.querySelector<HTMLTextAreaElement>('textarea')!;

    box.value = 'Qué hace esto?';
    box.dispatchEvent(new Event('input'));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await settle();
    await settle();

    expect(api.chat).toHaveBeenCalledWith(
      'p1',
      [{ role: 'user', content: 'Qué hace esto?' }],
      undefined,
    );
    const messages = Array.from(element.querySelectorAll('.msg'));
    expect(messages.map((m) => m.getAttribute('data-role'))).toEqual(['user', 'assistant']);
    expect(messages[1].querySelector('strong')?.textContent).toBe('X');
    expect(box.value).toBe('');
  });

  it('shows which file the AI knows the user is looking at, and nothing without one', async () => {
    store.toggle();
    const element = await render();
    expect(element.querySelector('.panel__file')).toBeNull();

    store.setContext({ path: 'src/Services/Gps.php', status: 'modified' });
    await settle();
    await settle();

    const chip = element.querySelector('.panel__file')!;
    expect(chip.textContent).toContain('Gps.php');
    expect(chip.textContent).not.toContain('src/Services');
    expect(chip.getAttribute('title')).toBe('src/Services/Gps.php');
  });

  it('does not send with Shift+Enter, which is a line break', async () => {
    store.toggle();
    const element = await render();
    const box = element.querySelector<HTMLTextAreaElement>('textarea')!;

    box.value = 'primera línea';
    box.dispatchEvent(new Event('input'));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    await settle();

    expect(api.chat).not.toHaveBeenCalled();
  });

  it('says it is thinking while the answer is on its way', async () => {
    api.chat.mockReturnValue(new Subject<ChatReply>());
    store.toggle();
    const element = await render();

    void store.send('hola');
    await settle();

    expect(element.querySelector('.panel__pending')?.textContent).toContain('Pensando');
    expect(element.querySelector<HTMLTextAreaElement>('textarea')!.disabled).toBe(true);
  });
});
