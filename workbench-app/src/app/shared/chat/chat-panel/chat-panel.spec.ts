import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatConversation } from '../chat-conversation';
import { ChatMessage } from '../chat.models';
import { ChatPanel } from './chat-panel';

/** Una conversación mínima que contesta siempre lo mismo. */
class FakeConversation extends ChatConversation {
  protected readonly storagePrefix = 'test.chat.';
  readonly requests = signal<ChatMessage[][]>([]);

  protected request(_key: string, messages: ChatMessage[]): Promise<string> {
    this.requests.update((all) => [...all, messages]);
    return Promise.resolve('Respuesta');
  }
}

describe('ChatPanel', () => {
  let chat: FakeConversation;

  beforeEach(() => {
    localStorage.clear();
    chat = new FakeConversation();
    chat.bind('k');
    chat.toggle();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ChatPanel);
    fixture.componentRef.setInput('store', chat);
    fixture.componentRef.setInput('heading', 'Chat de prueba');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('keeps the line breaks of what the user wrote, but not those of the answer', async () => {
    const element = await render();
    const box = element.querySelector<HTMLTextAreaElement>('textarea')!;

    box.value = 'primera línea\nsegunda línea';
    box.dispatchEvent(new Event('input'));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await settle();
    await settle();

    const [user, assistant] = Array.from(element.querySelectorAll('.msg'));
    expect(user.querySelector('br')).not.toBeNull();
    expect(user.textContent).toContain('primera línea');
    expect(assistant.querySelector('br')).toBeNull();
  });

  it('has the text on top and, below a divider, a bar with the send button', async () => {
    const element = await render();
    const composer = element.querySelector('.composer')!;
    const children = Array.from(composer.children);

    expect(children.map((child) => child.tagName.toLowerCase())).toEqual(['textarea', 'div']);
    expect(children[1].classList.contains('composer__bar')).toBe(true);
    expect(children[1].querySelector('.panel__send')).not.toBeNull();
    expect(element.querySelector('.composer__hint')?.textContent).toContain('Enter');
  });

  it('keeps the actions of each screen apart from the box to write in', async () => {
    const element = await render();
    const footer = element.querySelector('.panel__footer')!;

    expect(Array.from(footer.children).map((child) => child.className)).toEqual([
      'panel__actions',
      'composer',
    ]);
  });
});
