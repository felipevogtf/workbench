/** Slack corta los mensajes largos: se parte la revisión en trozos de este tamaño. */
export const SLACK_CHUNK_SIZE = 3500;

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Escapa un texto que va dentro de un enlace de Slack (`<url|texto>`). */
export function slackText(text: string): string {
  return escape(text).replace(/\|/g, '¦');
}

/**
 * Convierte markdown de GitHub al formato (mrkdwn) de Slack: títulos y negritas con `*`, enlaces
 * `<url|texto>`. Los bloques de código se dejan tal cual (sin el lenguaje tras las comillas).
 */
export function toSlackMrkdwn(markdown: string): string {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line.replace(/^(\s*```)\S*/, '$1');
      }
      if (inFence) return escape(line);

      return escape(line)
        .replace(/^#{1,6}\s+(.*?)\s*#*$/, '*$1*')
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<$2|$1>');
    })
    .join('\n');
}

/** Parte un texto en trozos de como máximo `max` caracteres, cortando por líneas. */
export function splitForSlack(text: string, max = SLACK_CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const line of text.split('\n')) {
    // Una línea más larga que el trozo se corta a la fuerza.
    for (let i = 0; i < Math.max(line.length, 1); i += max) {
      const piece = line.slice(i, i + max);
      if (current && current.length + piece.length + 1 > max) {
        chunks.push(current);
        current = '';
      }
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}
