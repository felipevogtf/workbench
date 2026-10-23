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
