import { ATTACHMENTS_ONLY_TEXT } from '@shared/chat/chat.models';

/** El título con que arranca una conversación sin título: el primer mensaje lo reemplaza. */
export const NEW_SESSION_TITLE = 'Nueva conversación';

const MAX_TITLE = 60;

/**
 * El título de una conversación a partir de su primer mensaje: la primera línea con algo escrito, sin espacios de más y
 * recortada en una palabra. `null` si el mensaje no trae texto que sirva (solo adjuntos).
 */
export function titleFromMessage(text: string): string | null {
  const line = text
    .split(/\r?\n/)
    .map((each) => each.replace(/\s+/g, ' ').trim())
    .find((each) => each.length > 0);
  if (!line || line === ATTACHMENTS_ONLY_TEXT) return null;
  if (line.length <= MAX_TITLE) return line;
  const cut = line.slice(0, MAX_TITLE);
  // Si el corte cae justo al final de una palabra se deja entera; si no, se vuelve al espacio anterior.
  const space = line[MAX_TITLE] === ' ' ? -1 : cut.lastIndexOf(' ');
  return `${(space > MAX_TITLE / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
