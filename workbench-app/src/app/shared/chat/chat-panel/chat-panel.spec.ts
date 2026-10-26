import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatConversation } from '../chat-conversation';
import { ChatAttachment, ChatMessage } from '../chat.models';
import { ChatPanel } from './chat-panel';

/** Una conversación mínima que contesta siempre lo mismo. */
class FakeConversation extends ChatConversation {
  protected readonly storagePrefix = 'test.chat.';
  readonly requests = signal<ChatMessage[][]>([]);

  protected request(_key: string, messages: ChatMessage[]): Promise<string> {
    this.requests.update((all) => [...all, messages]);
    return Promise.resolve('Respuesta');
  }

  readonly uploads = vi.fn<(file: File) => Promise<ChatAttachment>>((file) =>
    Promise.resolve({ id: `id-${file.name}`, name: file.name, kind: 'pdf', size: file.size }),
  );

  protected upload(file: File): Promise<ChatAttachment> {
    return this.uploads(file);
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

  async function render(inputs: Record<string, unknown> = {}): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ChatPanel);
    fixture.componentRef.setInput('store', chat);
    fixture.componentRef.setInput('heading', 'Chat de prueba');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
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

describe('ChatPanel attachments', () => {
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
  const pdf = (name = 'informe.pdf') => new File(['contenido'], name, { type: 'application/pdf' });

  /** Un evento de arrastrar/pegar con los archivos que lleva. */
  function dropEvent(type: string, files: File[], extra: object = {}): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { files, types: files.length > 0 ? ['Files'] : [] },
    });
    Object.defineProperty(event, 'clipboardData', { value: { files } });
    return Object.assign(event, extra);
  }

  it('has a clip that opens the file picker, with only the types that can be attached', async () => {
    const element = await render();
    const clip = element.querySelector<HTMLButtonElement>('.composer__clip')!;
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    const open = vi.spyOn(input, 'click');

    clip.click();

    expect(open).toHaveBeenCalled();
    expect(input.multiple).toBe(true);
    const accepted = input.accept.split(',');
    expect(accepted).toEqual(expect.arrayContaining(['.pdf', '.png', '.jpg', '.csv', '.txt']));
    expect(accepted).not.toContain('.exe');
  });

  it('attaches the files picked, and picking the same file again works', async () => {
    const element = await render();
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [pdf()], configurable: true });

    input.dispatchEvent(new Event('change'));
    await settle();
    await settle();

    expect(chat.uploads).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
    expect(element.querySelector('.file__name')?.textContent).toBe('informe.pdf');
  });

  it('attaches the files dropped anywhere on the panel, and says where to drop while dragging', async () => {
    const element = await render();
    const panel = element.querySelector('.panel')!;
    const messages = element.querySelector('.panel__messages')!;

    messages.dispatchEvent(dropEvent('dragover', [pdf()]));
    await settle();
    expect(element.querySelector('.panel__drop')?.textContent).toContain('Suelta los archivos');

    messages.dispatchEvent(dropEvent('drop', [pdf('soltado.pdf')]));
    await settle();
    await settle();

    expect(panel.querySelector('.panel__drop')).toBeNull();
    expect(chat.uploads).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.file__name')?.textContent).toBe('soltado.pdf');
  });

  it('keeps showing where to drop while the pointer moves between parts of the panel, and stops when it leaves', async () => {
    const element = await render();
    const panel = element.querySelector('.panel')!;
    const messages = element.querySelector('.panel__messages')!;
    messages.dispatchEvent(dropEvent('dragover', [pdf()]));
    await settle();

    // Pasar de la conversación al pie sigue dentro del panel.
    panel.dispatchEvent(
      dropEvent('dragleave', [], { relatedTarget: element.querySelector('.composer') }),
    );
    await settle();
    expect(element.querySelector('.panel__drop')).not.toBeNull();

    // Salir del panel quita la capa.
    panel.dispatchEvent(dropEvent('dragleave', [], { relatedTarget: null }));
    await settle();
    expect(element.querySelector('.panel__drop')).toBeNull();
  });

  it('does not react to dragging something that is not a file, like selected text', async () => {
    const element = await render();
    const panel = element.querySelector('.panel')!;

    const event = dropEvent('dragover', []);
    panel.dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(false);
    expect(element.querySelector('.panel__drop')).toBeNull();
  });

  it('attaches a pasted file (a screenshot) instead of pasting it, but pastes text as usual', async () => {
    const element = await render();
    const box = element.querySelector<HTMLTextAreaElement>('textarea')!;

    const text = dropEvent('paste', []);
    box.dispatchEvent(text);
    expect(text.defaultPrevented).toBe(false);

    const image = dropEvent('paste', [new File(['x'], 'image.png', { type: 'image/png' })]);
    box.dispatchEvent(image);
    await settle();
    await settle();

    expect(image.defaultPrevented).toBe(true);
    expect(chat.uploads).toHaveBeenCalledTimes(1);
  });

  it('shows each file with its name and size, and lets the user remove it', async () => {
    const element = await render();
    await chat.attach([pdf('uno.pdf'), pdf('dos.pdf')]);
    await settle();

    const files = Array.from(element.querySelectorAll('.composer__files .file'));
    expect(files.map((f) => f.querySelector('.file__name')?.textContent)).toEqual([
      'uno.pdf',
      'dos.pdf',
    ]);
    expect(files[0].querySelector('.file__size')?.textContent?.trim()).toBe('9 B');

    files[0].querySelector<HTMLButtonElement>('.file__remove')!.click();
    await settle();

    expect(element.querySelectorAll('.composer__files .file')).toHaveLength(1);
  });

  it('says a file could not be uploaded, and why it was refused', async () => {
    const element = await render();
    chat.uploads.mockRejectedValueOnce(new Error('El servidor no responde'));

    await chat.attach([pdf('malo.pdf'), new File(['x'], 'programa.exe')]);
    await settle();

    const failed = element.querySelector('.file[data-status="error"]')!;
    expect(failed.textContent).toContain('no se pudo subir');
    expect(failed.getAttribute('title')).toBe('El servidor no responde');
    expect(element.querySelector('.composer__error')?.textContent).toContain('programa.exe');
  });

  it('can send just the files, but not while one is still uploading', async () => {
    const element = await render();
    const send = element.querySelector<HTMLButtonElement>('.panel__send')!;
    expect(send.disabled).toBe(true);

    let finish!: () => void;
    chat.uploads.mockImplementationOnce(
      (file) =>
        new Promise((resolve) => {
          finish = () => resolve({ id: 'a1', name: file.name, kind: 'pdf', size: 9 });
        }),
    );
    void chat.attach([pdf()]);
    await settle();
    expect(send.disabled).toBe(true);

    finish();
    await settle();
    await settle();

    expect(send.disabled).toBe(false);
  });

  it('keeps what was typed when it cannot be sent yet because a file is uploading', async () => {
    const element = await render();
    const box = element.querySelector<HTMLTextAreaElement>('textarea')!;
    chat.uploads.mockImplementationOnce(() => new Promise(() => undefined));
    void chat.attach([pdf()]);

    box.value = 'mi pregunta';
    box.dispatchEvent(new Event('input'));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await settle();

    expect(box.value).toBe('mi pregunta');
    expect(chat.messages()).toEqual([]);
  });

  it('shows the files of a message under its text', async () => {
    const element = await render();
    await chat.attach([pdf('informe.pdf')]);
    await chat.send('Revisa este informe');
    await settle();
    await settle();

    const bubble = element.querySelector('.msg[data-role="user"]')!;
    expect(bubble.querySelector('.msg__files')?.textContent).toContain('informe.pdf');
    expect(element.querySelector('.composer__files')).toBeNull();
  });
});

describe('ChatPanel empty state and context', () => {
  let chat: FakeConversation;

  beforeEach(() => {
    localStorage.clear();
    chat = new FakeConversation();
    chat.bind('k');
    chat.toggle();
  });

  async function render(inputs: Record<string, unknown> = {}): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ChatPanel);
    fixture.componentRef.setInput('store', chat);
    fixture.componentRef.setInput('heading', 'Chat de prueba');
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('says what the chat is for and offers questions to start with', async () => {
    const element = await render({
      emptyTitle: '¿Cómo mejoramos el plan?',
      suggestions: ['Primera pregunta', 'Segunda pregunta'],
    });

    expect(element.querySelector('.empty__title')?.textContent).toBe('¿Cómo mejoramos el plan?');
    expect(
      Array.from(element.querySelectorAll('.empty__suggestions button')).map((b) =>
        b.textContent?.trim(),
      ),
    ).toEqual(['Primera pregunta', 'Segunda pregunta']);
  });

  it('leaves the chosen question written in the box, ready to edit, without sending it', async () => {
    const element = await render({ suggestions: ['¿Qué dudas deja el plan?'] });
    const box = element.querySelector<HTMLTextAreaElement>('textarea')!;

    element.querySelector<HTMLButtonElement>('.empty__suggestions button')!.click();
    await settle();

    expect(box.value).toBe('¿Qué dudas deja el plan?');
    expect(chat.requests()).toEqual([]);
    expect(element.querySelector<HTMLButtonElement>('.panel__send')!.disabled).toBe(false);
  });

  it('has no suggestions list when there are none, and stops showing the start once there are messages', async () => {
    const element = await render();
    expect(element.querySelector('.empty__suggestions')).toBeNull();

    await chat.send('hola');
    await settle();
    await settle();

    expect(element.querySelector('.empty')).toBeNull();
  });

  it('shows what the AI knows as a label under the title, with the detail as a tooltip', async () => {
    const element = await render({ info: 'Hablando de big.ts', infoTitle: 'src/big.ts' });

    const label = element.querySelector('.panel__info')!;
    expect(label.textContent).toContain('Hablando de big.ts');
    expect(label.getAttribute('title')).toBe('src/big.ts');
    expect(element.querySelector('.panel__head')!.contains(label)).toBe(true);
  });

  it('shows no label without context', async () => {
    const element = await render();

    expect(element.querySelector('.panel__info')).toBeNull();
  });

  describe('with an assistant', () => {
    const lucy = { name: 'Lucy', avatar: null };

    it('shows her avatar on the button instead of the chat icon, and on her answers', async () => {
      chat.toggle(); // cerrado: se ve el botón
      const closed = await render({ assistant: lucy });
      expect(closed.querySelector('.fab app-avatar')).not.toBeNull();
      expect(closed.querySelector('.fab app-icon')).toBeNull();
      expect(closed.querySelector('.fab')?.getAttribute('aria-label')).toBe(
        'Abrir el chat con Lucy',
      );
    });

    it('keeps the close icon on the button while the panel is open, and names her in the panel', async () => {
      const element = await render({ assistant: lucy });

      expect(element.querySelector('.fab app-avatar')).toBeNull();
      expect(element.querySelector('.fab app-icon')).not.toBeNull();
      expect(element.querySelector('.panel__head app-avatar')).not.toBeNull();
    });

    it('labels her answers with her name', async () => {
      const element = await render({ assistant: lucy });
      const box = element.querySelector<HTMLTextAreaElement>('textarea')!;

      box.value = 'hola';
      box.dispatchEvent(new Event('input'));
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
      await settle();
      await settle();

      const [user, assistant] = Array.from(element.querySelectorAll('.msg'));
      expect(user.querySelector('.msg__who')).toBeNull();
      expect(assistant.querySelector('.msg__who')?.textContent).toContain('Lucy');
    });

    it('keeps the generic chat icon when there is no assistant', async () => {
      chat.toggle();
      const element = await render();

      expect(element.querySelector('.fab app-avatar')).toBeNull();
      expect(element.querySelector('.fab app-icon')).not.toBeNull();
    });
  });

  describe('without attachments', () => {
    it('has no clip, no file picker and no drop zone', async () => {
      const element = await render({ attachments: false });

      expect(element.querySelector('.composer__clip')).toBeNull();
      expect(element.querySelector('input[type="file"]')).toBeNull();
    });

    it('still has them by default', async () => {
      const element = await render();

      expect(element.querySelector('.composer__clip')).not.toBeNull();
      expect(element.querySelector('input[type="file"]')).not.toBeNull();
    });
  });

  describe('unread answers', () => {
    const badge = (element: HTMLElement) => element.querySelector('.fab .fab__badge');

    it('counts the answers that arrive while the panel is closed, and tells it on the button', async () => {
      chat.toggle(); // se cierra
      const element = await render({ assistant: { name: 'Lucy', avatar: null } });
      expect(badge(element)).toBeNull();

      await chat.send('hola');
      await chat.send('otra cosa');
      await settle();
      element.ownerDocument.defaultView?.dispatchEvent(new Event('resize'));

      expect(chat.unread()).toBe(2);
    });

    it('shows the count, pulses and says it to screen readers while there are unread answers', async () => {
      chat.toggle();
      const fixture = TestBed.createComponent(ChatPanel);
      fixture.componentRef.setInput('store', chat);
      fixture.componentRef.setInput('heading', 'Chat');
      fixture.componentRef.setInput('assistant', { name: 'Lucy', avatar: null });
      await fixture.whenStable();

      await chat.send('hola');
      await fixture.whenStable();
      fixture.detectChanges();

      const element: HTMLElement = fixture.nativeElement;
      const fab = element.querySelector('.fab')!;
      expect(fab.classList.contains('fab--unread')).toBe(true);
      expect(badge(element)?.textContent?.trim()).toBe('1');
      expect(fab.getAttribute('aria-label')).toBe('1 mensaje nuevo. Abrir el chat con Lucy');
    });

    it('does not count the answers that arrive while the panel is open', async () => {
      await chat.send('hola'); // el panel está abierto
      await settle();

      expect(chat.unread()).toBe(0);
    });

    it('marks them as seen when the panel is opened', async () => {
      chat.toggle(); // cerrado
      await chat.send('hola');
      expect(chat.unread()).toBe(1);

      chat.toggle(); // abierto

      expect(chat.unread()).toBe(0);
    });

    it('shows 9+ when there are more than nine', async () => {
      chat.toggle();
      const fixture = TestBed.createComponent(ChatPanel);
      fixture.componentRef.setInput('store', chat);
      fixture.componentRef.setInput('heading', 'Chat');
      await fixture.whenStable();

      for (let i = 0; i < 10; i++) await chat.send('pregunta ' + i);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(badge(fixture.nativeElement)?.textContent?.trim()).toBe('9+');
    });
  });

  describe('a message the assistant sends on its own', () => {
    it('joins the conversation, and counts as unread while the panel is closed', () => {
      chat.toggle(); // cerrado

      chat.receive('David me preguntó algo');

      expect(chat.messages().at(-1)).toMatchObject({
        role: 'assistant',
        content: 'David me preguntó algo',
      });
      expect(chat.unread()).toBe(1);
    });

    it('is not unread when the panel is open', () => {
      chat.receive('David me preguntó algo');

      expect(chat.unread()).toBe(0);
    });
  });
});
