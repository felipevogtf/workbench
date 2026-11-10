import { readableTicket } from './ticket-markdown';

describe('readableTicket', () => {
  it('turns <br> into line breaks', () => {
    expect(readableTicket('**Como** conductor<br>**Quiero** un tono')).toBe(
      '**Como** conductor\n**Quiero** un tono',
    );
  });

  it('separates a list glued to the paragraph above, so it renders as a list', () => {
    expect(readableTicket('**Criterios:**\n- Uno\n- Dos')).toBe('**Criterios:**\n\n- Uno\n- Dos');
  });

  it('keeps a list that is already separated, and numbered ones', () => {
    expect(readableTicket('Pasos:\n\n1. Uno\n2. Dos')).toBe('Pasos:\n\n1. Uno\n2. Dos');
  });

  it('removes trailing spaces and backslashes used as hard breaks', () => {
    expect(readableTicket(['Uno  ', 'Dos\\', 'Tres'].join('\n'))).toBe('Uno\nDos\nTres');
  });

  it('leaves code blocks alone', () => {
    const code = 'Ejemplo:\n\n```\ntexto\n- no es lista  \n```';
    expect(readableTicket(code)).toBe(code);
  });
});
