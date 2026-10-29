/** Cuántas claves de ticket se toman de un texto (acota el trabajo de quien las busca en el remoto). */
export const MAX_MENTIONED_KEYS = 4;

const KEY = /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g;

/** Las claves de ticket (`MEL-466`) que aparecen en los textos, sin repetir y en orden de aparición. */
export function mentionedTicketKeys(
  texts: readonly (string | null | undefined)[],
): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text?.matchAll(KEY) ?? []) found.add(match[0]);
  }
  return [...found].slice(0, MAX_MENTIONED_KEYS);
}
