import { ChatConversation } from './chat-conversation';
import {
  ATTACHMENTS_ONLY_TEXT,
  ChatAttachment,
  ChatMessage,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from './chat.models';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeConversation extends ChatConversation {
  protected readonly storagePrefix = 'test.attachments.';
  readonly requests: ChatMessage[][] = [];
  readonly uploads = vi.fn<(file: File) => Promise<ChatAttachment>>();

  protected request(_key: string, messages: ChatMessage[]): Promise<string> {
    this.requests.push(messages);
    return Promise.resolve('Respuesta');
  }

  protected upload(file: File): Promise<ChatAttachment> {
    return this.uploads(file);
  }
}

const file = (name: string, size = 100) => {
  const created = new File(['contenido'], name);
  Object.defineProperty(created, 'size', { value: size });
  return created;
};

const uploaded = (name: string, id = `id-${name}`): ChatAttachment => ({
  id,
  name,
  kind: name.endsWith('.png') ? 'image' : 'pdf',
  size: 100,
});

describe('ChatConversation attachments', () => {
  let chat: FakeConversation;

  beforeEach(() => {
    localStorage.clear();
    chat = new FakeConversation();
    chat.bind('k');
    chat.uploads.mockImplementation((f) => Promise.resolve(uploaded(f.name)));
  });

  describe('attaching', () => {
    it('uploads the file and keeps it ready for the next message', async () => {
      await chat.attach([file('informe.pdf')]);

      expect(chat.uploads).toHaveBeenCalledTimes(1);
      expect(chat.draftAttachments()).toEqual([
        expect.objectContaining({
          name: 'informe.pdf',
          status: 'ready',
          attachment: uploaded('informe.pdf'),
        }),
      ]);
      expect(chat.attachError()).toBeNull();
    });

    it('shows the file as uploading until the server answers, and cannot be sent meanwhile', async () => {
      const upload = deferred<ChatAttachment>();
      chat.uploads.mockReturnValueOnce(upload.promise);

      const attaching = chat.attach([file('informe.pdf')]);

      expect(chat.draftAttachments()[0].status).toBe('uploading');
      expect(chat.uploading()).toBe(true);
      expect(chat.canSend('hola')).toBe(false);

      upload.resolve(uploaded('informe.pdf'));
      await attaching;

      expect(chat.draftAttachments()[0].status).toBe('ready');
      expect(chat.canSend('hola')).toBe(true);
    });

    it.each([
      ['a type that is not accepted', 'programa.exe', 100, /Solo se pueden adjuntar/],
      ['a file without extension', 'LEEME', 100, /Solo se pueden adjuntar/],
      ['an empty file', 'vacio.pdf', 0, /vacío/],
      [
        'a file over the maximum size',
        'enorme.pdf',
        MAX_ATTACHMENT_BYTES + 1,
        /máximo es 10\.0 MB/,
      ],
    ])('refuses %s without uploading it, saying why', async (_case, name, size, message) => {
      await chat.attach([file(name, size)]);

      expect(chat.uploads).not.toHaveBeenCalled();
      expect(chat.draftAttachments()).toEqual([]);
      expect(chat.attachError()).toMatch(message);
      expect(chat.attachError()).toContain(name);
    });

    it('attaches the valid files even if another one of the batch is refused', async () => {
      await chat.attach([file('a.pdf'), file('programa.exe'), file('b.png')]);

      expect(chat.draftAttachments().map((draft) => draft.name)).toEqual(['a.pdf', 'b.png']);
      expect(chat.attachError()).toContain('programa.exe');
    });

    it('accepts the types it promises: pdf, images, text and csv', async () => {
      const names = ['a.pdf', 'b.png', 'c.JPG', 'd.webp', 'e.txt', 'f.csv'];

      await chat.attach(names.map((name) => file(name)));

      expect(chat.draftAttachments()).toHaveLength(
        names.length > MAX_ATTACHMENTS_PER_MESSAGE ? MAX_ATTACHMENTS_PER_MESSAGE : names.length,
      );
    });

    it(`does not take more than ${MAX_ATTACHMENTS_PER_MESSAGE} files per message`, async () => {
      const files = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 2 }, (_, i) =>
        file(`f${i}.pdf`),
      );

      await chat.attach(files);

      expect(chat.draftAttachments()).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE);
      expect(chat.uploads).toHaveBeenCalledTimes(MAX_ATTACHMENTS_PER_MESSAGE);
      expect(chat.attachError()).toContain(`Máximo ${MAX_ATTACHMENTS_PER_MESSAGE}`);
    });

    it('keeps the file as failed when the upload fails, without counting it against the limit', async () => {
      chat.uploads.mockRejectedValueOnce(new Error('El servidor no responde'));

      await chat.attach([file('informe.pdf')]);

      expect(chat.draftAttachments()[0]).toMatchObject({
        status: 'error',
        error: 'El servidor no responde',
      });
      // Un archivo fallido no se envía.
      expect(chat.canSend('')).toBe(false);

      await chat.attach(
        Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, i) => file(`f${i}.pdf`)),
      );
      expect(chat.draftAttachments().filter((draft) => draft.status === 'ready')).toHaveLength(
        MAX_ATTACHMENTS_PER_MESSAGE,
      );
    });

    it('lets the user remove a file before sending', async () => {
      await chat.attach([file('a.pdf'), file('b.pdf')]);
      const [first] = chat.draftAttachments();

      chat.removeAttachment(first.key);

      expect(chat.draftAttachments().map((draft) => draft.name)).toEqual(['b.pdf']);
    });

    it('ignores what a late upload brings when the conversation changed in the meantime', async () => {
      const upload = deferred<ChatAttachment>();
      chat.uploads.mockReturnValueOnce(upload.promise);
      const attaching = chat.attach([file('informe.pdf')]);

      chat.bind('otra');
      upload.resolve(uploaded('informe.pdf'));
      await attaching;

      expect(chat.draftAttachments()).toEqual([]);
    });

    it('starts each conversation without files', async () => {
      await chat.attach([file('a.pdf')]);

      chat.bind('otra');

      expect(chat.draftAttachments()).toEqual([]);
      expect(chat.attachError()).toBeNull();
    });
  });

  describe('sending', () => {
    it('sends the attached files with the message and leaves the box clean', async () => {
      await chat.attach([file('informe.pdf'), file('captura.png')]);

      await chat.send('Revisa esto');

      const [message] = chat.messages();
      expect(message).toEqual({
        role: 'user',
        content: 'Revisa esto',
        attachments: [uploaded('informe.pdf'), uploaded('captura.png')],
      });
      expect(chat.requests[0][0].attachments).toHaveLength(2);
      expect(chat.draftAttachments()).toEqual([]);
    });

    it('can send only files: the message says so', async () => {
      await chat.attach([file('informe.pdf')]);

      expect(chat.canSend('')).toBe(true);
      await chat.send('   ');

      expect(chat.messages()[0].content).toBe(ATTACHMENTS_ONLY_TEXT);
      expect(chat.messages()[0].attachments).toHaveLength(1);
    });

    it('does not send an empty message', async () => {
      expect(chat.canSend('  ')).toBe(false);

      await chat.send('  ');

      expect(chat.messages()).toEqual([]);
    });

    it('does not send while a file is still uploading, and keeps the file', async () => {
      const upload = deferred<ChatAttachment>();
      chat.uploads.mockReturnValueOnce(upload.promise);
      void chat.attach([file('informe.pdf')]);

      await chat.send('Revisa esto');

      expect(chat.messages()).toEqual([]);
      expect(chat.draftAttachments()).toHaveLength(1);
    });

    it('sends only what is ready, leaving out the files that failed', async () => {
      chat.uploads
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(uploaded('b.pdf'));
      await chat.attach([file('a.pdf'), file('b.pdf')]);

      await chat.send('hola');

      expect(chat.messages()[0].attachments).toEqual([uploaded('b.pdf')]);
    });

    it('does not add an empty list of attachments to a message without files', async () => {
      await chat.send('hola');

      expect(chat.messages()[0]).toEqual({ role: 'user', content: 'hola' });
    });
  });

  describe('what travels and what is kept', () => {
    it('gives the attachments of every message in the snapshot (also for replanning)', async () => {
      await chat.attach([file('informe.pdf')]);
      await chat.send('Revisa esto');

      const snapshot = chat.snapshot();

      expect(snapshot[0].attachments).toEqual([uploaded('informe.pdf')]);
      expect(snapshot[1]).toEqual({ role: 'assistant', content: 'Respuesta' });
    });

    it('keeps the attachments of the messages in the browser', async () => {
      await chat.attach([file('informe.pdf')]);
      await chat.send('Revisa esto');

      const fresh = new FakeConversation();
      fresh.bind('k');

      expect(fresh.messages()[0].attachments).toEqual([uploaded('informe.pdf')]);
    });

    it('drops the invalid attachments it finds saved, keeping the message', () => {
      localStorage.setItem(
        'test.attachments.raro',
        JSON.stringify([
          {
            role: 'user',
            content: 'hola',
            attachments: [{ id: 5 }, null, { id: 'ok', name: 'a.pdf', kind: 'pdf', size: 1 }],
          },
          { role: 'user', content: 'sin nada', attachments: 'no es una lista' },
        ]),
      );
      const fresh = new FakeConversation();

      fresh.bind('raro');

      expect(fresh.messages()[0].attachments).toEqual([
        { id: 'ok', name: 'a.pdf', kind: 'pdf', size: 1 },
      ]);
      expect(fresh.messages()[1]).toEqual({ role: 'user', content: 'sin nada' });
    });

    it('clears the files too when the conversation is cleared', async () => {
      await chat.attach([file('a.pdf')]);

      chat.clear();

      expect(chat.draftAttachments()).toEqual([]);
    });
  });
});
