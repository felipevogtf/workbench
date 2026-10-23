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

  it('attaches the files dropped on the box and marks where to drop while dragging', async () => {
    const element = await render();
    const composer = element.querySelector('.composer')!;

    composer.dispatchEvent(dropEvent('dragover', [pdf()]));
    await settle();
    expect(composer.classList.contains('is-dragging')).toBe(true);

    composer.dispatchEvent(dropEvent('drop', [pdf('soltado.pdf')]));
    await settle();
    await settle();

    expect(composer.classList.contains('is-dragging')).toBe(false);
    expect(chat.uploads).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.file__name')?.textContent).toBe('soltado.pdf');
  });

  it('does not react to dragging something that is not a file, like selected text', async () => {
    const element = await render();
    const composer = element.querySelector('.composer')!;

    const event = dropEvent('dragover', []);
    composer.dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(false);
    expect(composer.classList.contains('is-dragging')).toBe(false);
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
