import {
  conversationLines,
  MAX_CHAT_MESSAGE_CHARS,
  userTexts,
} from './conversation';

const msg = (role: 'user' | 'assistant', content: string) => ({
  role,
  content,
});

describe('conversationLines', () => {
  it('writes each message with who said it, in order', () => {
    const lines = conversationLines(
      [msg('user', 'hola'), msg('assistant', 'qué tal')],
      {
        maxMessages: 10,
        maxChars: 1000,
      },
    );

    expect(lines.join('\n')).toBe(
      '### Usuario\nhola\n\n### Asistente\nqué tal\n',
    );
  });

  it('keeps the latest messages and says how many it left out', () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      msg('user', `mensaje-${i}`),
    );

    const text = conversationLines(messages, {
      maxMessages: 3,
      maxChars: 1000,
    }).join('\n');

    expect(text).toContain('(3 mensajes anteriores omitidos)');
    expect(text).not.toContain('mensaje-2');
    expect(text).toContain('mensaje-3');
    expect(text).toContain('mensaje-5');
  });

  it('drops the oldest messages first when they do not fit in the characters allowed', () => {
    const messages = [
      msg('user', 'a'.repeat(60)),
      msg('assistant', 'b'.repeat(60)),
      msg('user', 'c'.repeat(60)),
    ];

    const text = conversationLines(messages, {
      maxMessages: 10,
      maxChars: 130,
    }).join('\n');

    expect(text).toContain('(1 mensajes anteriores omitidos)');
    expect(text).not.toContain('a'.repeat(60));
    expect(text).toContain('c'.repeat(60));
  });

  it('always keeps the last message, however long', () => {
    const text = conversationLines([msg('user', 'x'.repeat(500))], {
      maxMessages: 10,
      maxChars: 10,
    }).join('\n');

    expect(text).toContain('x'.repeat(500));
  });

  it('cuts a message that is too long', () => {
    const text = conversationLines(
      [msg('user', 'x'.repeat(MAX_CHAT_MESSAGE_CHARS + 100))],
      {
        maxMessages: 10,
        maxChars: 1_000_000,
      },
    ).join('\n');

    expect(text).toContain('…(recortado)');
    expect(text).not.toContain('x'.repeat(MAX_CHAT_MESSAGE_CHARS + 1));
  });
});

describe('userTexts', () => {
  it('gives what the user said, most recent first', () => {
    expect(
      userTexts([
        msg('user', 'uno'),
        msg('assistant', 'respuesta'),
        msg('user', 'dos'),
      ]),
    ).toEqual(['dos', 'uno']);
  });
});

describe('conversationLines with attachments', () => {
  const staged = new Map([
    [
      'a1',
      {
        id: 'a1',
        name: 'informe.pdf',
        path: '.attachments/a1-informe.pdf',
        kind: 'pdf' as const,
        size: 2048,
      },
    ],
  ]);
  const withFile = {
    role: 'user' as const,
    content: 'Mira el informe',
    attachments: [{ id: 'a1', name: 'informe.pdf' }],
  };
  const limits = { maxMessages: 10, maxChars: 1000 };

  it('lists the attachments under their message and explains how to read them once', () => {
    const text = conversationLines(
      [withFile, msg('assistant', 'Lo leo'), withFile],
      limits,
      staged,
    ).join('\n');

    expect(text).toContain(
      '### Usuario\nMira el informe\nAdjuntos:\n- informe.pdf (PDF, 2 KB): `.attachments/a1-informe.pdf`',
    );
    expect(text.split('herramienta Read')).toHaveLength(2);
    expect(text.indexOf('herramienta Read')).toBeLessThan(
      text.indexOf('### Usuario'),
    );
  });

  it('says so when an attachment is no longer there', () => {
    const text = conversationLines([withFile], limits, new Map()).join('\n');

    expect(text).toContain('informe.pdf: ya no está disponible');
  });

  it('does not mention the attachments of the messages it left out', () => {
    const text = conversationLines(
      [withFile, msg('user', 'otro'), msg('user', 'último')],
      { maxMessages: 2, maxChars: 1000 },
      staged,
    ).join('\n');

    expect(text).toContain('(1 mensajes anteriores omitidos)');
    expect(text).not.toContain('informe.pdf');
    expect(text).not.toContain('herramienta Read');
  });

  it('is the same as before for a conversation without attachments', () => {
    const text = conversationLines([msg('user', 'hola')], limits).join('\n');

    expect(text).toBe('### Usuario\nhola\n');
  });
});
