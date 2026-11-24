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

const MAX_PROBLEMS_SHOWN = 5;
const MAX_PROBLEM_CHARS = 160;

/** Cómo terminó la revisión, según su veredicto. */
export type ReviewOutcome =
  'approved' | 'approved-with-comments' | 'changes-requested' | 'rejected';

/** Lo que el aviso de Slack adelanta de la revisión: cómo terminó y los problemas, en una línea cada uno. */
export interface ReviewHighlights {
  /** null = la revisión no trae un veredicto que se reconozca. */
  outcome: ReviewOutcome | null;
  /** Ya recortados y listos para mostrar; vacío = sin problemas (o no se pudieron leer). */
  problems: string[];
  /** Problemas que no caben en el aviso y quedan solo en el archivo. */
  hiddenProblems: number;
}

/** Las líneas de una sección (`## Veredicto`, `### Problemas`…) hasta el siguiente título o `---`. */
function sectionLines(markdown: string, title: RegExp): string[] | null {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) =>
    new RegExp(`^#{2,4}\\s*(?:\\d+[.)]\\s*)?${title.source}\\s*$`, 'i').test(
      line.trim(),
    ),
  );
  if (start === -1) return null;

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line.trim()) || /^-{3,}\s*$/.test(line.trim())) break;
    body.push(line);
  }
  return body;
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function outcomeOf(verdictLine: string | undefined): ReviewOutcome | null {
  const text = (verdictLine ?? '')
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

/**
 * Saca de la revisión (markdown) cómo terminó y los problemas del código para ponerlos en el aviso, de modo que
 * quien la recibe sepa qué pasó sin abrir el archivo. Si la revisión no trae esas secciones, devuelve lo que haya.
 */
export function summarizeReview(markdown: string): ReviewHighlights {
  const verdictLine = sectionLines(markdown, /veredicto/)
    ?.map((line) => line.trim())
    .find(Boolean);

  const bullets = (sectionLines(markdown, /problemas/) ?? [])
    .map((line) => /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line.trim())?.[1])
    .filter((text): text is string => !!text?.trim())
    .filter((text) => !/^ninguno\b/i.test(text.trim()));

  return {
    outcome: outcomeOf(verdictLine),
    problems: bullets
      .slice(0, MAX_PROBLEMS_SHOWN)
      .map((text) => shorten(toSlackMrkdwn(text.trim()), MAX_PROBLEM_CHARS)),
    hiddenProblems: Math.max(0, bullets.length - MAX_PROBLEMS_SHOWN),
  };
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
