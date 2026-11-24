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

/** Cómo terminó la revisión, según su veredicto. */
export type ReviewOutcome =
  'approved' | 'approved-with-comments' | 'changes-requested' | 'rejected';

/** Las líneas de la sección `## Veredicto` hasta el siguiente título o `---`. */
function verdictLine(markdown: string): string | undefined {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) =>
    /^#{2,4}\s*(?:\d+[.)]\s*)?veredicto\s*$/i.test(line.trim()),
  );
  if (start === -1) return undefined;

  for (const line of lines.slice(start + 1)) {
    const text = line.trim();
    if (/^#{1,6}\s/.test(text) || /^-{3,}$/.test(text)) return undefined;
    if (text) return text;
  }
  return undefined;
}

/** Cómo terminó la revisión, leído de su veredicto; null si no trae uno que se reconozca. */
export function reviewOutcome(markdown: string): ReviewOutcome | null {
  const text = (verdictLine(markdown) ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (/pedir cambios|necesita cambios/.test(text)) return 'changes-requested';
  if (/rechaz/.test(text)) return 'rejected';
  if (/aprobar con comentarios|aprobad[ao] con comentarios/.test(text)) {
    return 'approved-with-comments';
  }
  if (/aprobar|aprobad[ao]/.test(text)) return 'approved';
  return null;
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
