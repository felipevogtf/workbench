import { ATTACHMENTS_ONLY_TEXT } from '@shared/chat/chat.models';
import { titleFromMessage } from './session-title';

describe('titleFromMessage', () => {
  it('uses the first line that has text, without extra spaces', () => {
    expect(titleFromMessage('\n\n  Arreglar   el login  \ny el logout')).toBe('Arreglar el login');
  });

  it('keeps a short message whole', () => {
    expect(titleFromMessage('Hola')).toBe('Hola');
  });

  it('cuts a long message at a word and adds an ellipsis', () => {
    const title = titleFromMessage(
      'Necesito que revises por qué la guía de despacho no se firma cuando el camión llega sin patente registrada',
    );

    expect(title).toBe('Necesito que revises por qué la guía de despacho no se firma…');
    expect(title!.length).toBeLessThanOrEqual(61);
  });

  it('cuts a long text without spaces at the limit', () => {
    expect(titleFromMessage('a'.repeat(200))).toBe(`${'a'.repeat(60)}…`);
  });

  it('gives nothing when there is no text, or it is the placeholder of an attachment-only message', () => {
    expect(titleFromMessage('   \n ')).toBeNull();
    expect(titleFromMessage(ATTACHMENTS_ONLY_TEXT)).toBeNull();
  });
});
