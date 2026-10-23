import { DIFF_STATUS_LABEL, DiffFile, DiffHunk } from './diff';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** El archivo que el usuario tiene abierto en el diff: se le pasa a la IA para que sepa de qué se habla. */
export interface ChatFileContext {
  path: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  /** Ruta anterior, solo si el archivo se renombró. */
  oldPath?: string;
}

export interface ChatReply {
  reply: string;
  agentName: string;
  model: string;
  /** Commit de la rama de la PR sobre el que contestó el agente. */
  commit: string;
}

/** Largo máximo de un mensaje que acepta el servidor; lo que pase de ahí se recorta al enviarlo. */
export const MAX_MESSAGE_CHARS = 30_000;

/** Lo más que se pega de un segmento de código en un mensaje, para dejar espacio a la conversación. */
const MAX_SNIPPET_CHARS = 20_000;

/** El segmento como diff: contexto con espacio, eliminadas con «-» y añadidas con «+». */
export function hunkAsDiff(hunk: DiffHunk): string {
  const lines = [hunk.header];
  let removed: string[] = [];
  let added: string[] = [];

  // Las eliminadas y añadidas de un mismo bloque van juntas, como en un diff de verdad.
  const flush = () => {
    lines.push(...removed, ...added);
    removed = [];
    added = [];
  };

  for (const { left, right } of hunk.rows) {
    if (left?.kind === 'context') {
      flush();
      lines.push(` ${left.text}`);
      continue;
    }
    if (left) removed.push(`-${left.text}`);
    if (right) added.push(`+${right.text}`);
  }
  flush();

  return lines.join('\n');
}

/** Una cerca de código más larga que cualquier racha de comillas del contenido, para no romperla. */
function fenceFor(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  return '`'.repeat(Math.max(3, longest + 1));
}

/** El mensaje que se manda al chat al pulsar el botón de IA de un segmento. */
export function buildExplainMessage(file: DiffFile, hunk: DiffHunk): string {
  const diff = hunkAsDiff(hunk);
  const code =
    diff.length > MAX_SNIPPET_CHARS
      ? `${diff.slice(0, MAX_SNIPPET_CHARS).trimEnd()}\n…(recortado)`
      : diff;
  const fence = fenceFor(code);
  const status = DIFF_STATUS_LABEL[file.status].toLowerCase();

  return [
    `Explícame qué hace este segmento de código del archivo \`${file.path}\` (${status} en esta PR): ` +
      'qué cambia y para qué sirve. Sé breve y menciona un problema solo si es real.',
    '',
    `${fence}diff`,
    code,
    fence,
  ].join('\n');
}
