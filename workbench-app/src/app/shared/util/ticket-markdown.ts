const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;

/**
 * Deja legible la descripción de un ticket que viene de otra herramienta: los `<br>` pasan a saltos de línea y una lista que
 * arranca pegada al párrafo de arriba se separa de él, para que se muestre como lista y no como texto con guiones. No toca lo que
 * está dentro de bloques de código.
 */
export function readableTicket(text: string): string {
  const out: string[] = [];
  let fenced = false;

  for (const raw of text
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) fenced = !fenced;
    if (fenced || /^\s*(```|~~~)/.test(raw)) {
      out.push(raw);
      continue;
    }

    const line = raw.replace(/\s+$/, '').replace(/\$/, '');
    const previous = out[out.length - 1];
    if (
      ITEM.test(line) &&
      previous !== undefined &&
      previous.trim() !== '' &&
      !ITEM.test(previous)
    ) {
      out.push('');
    }
    out.push(line);
  }
  return out.join('\n');
}
