import { DiffCell, DiffFile, DiffHunk, DiffRow } from './diff';

/** Lo que muestra un archivo en «ver archivo completo»: cargando, listo (con todas sus líneas) o con error. */
export type FullFileState =
  | { status: 'loading' }
  | { status: 'ready'; hunk: DiffHunk }
  | { status: 'error'; message: string };

/** El archivo del proveedor ya no coincide con el diff que se cargó (llegaron commits nuevos). */
export class FullFileMismatchError extends Error {
  constructor() {
    super(
      'El archivo cambió en el proveedor desde que se cargó el diff. Recarga la página para ver lo último.',
    );
  }
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Las líneas del texto, sin el salto final del archivo ni el `\r` de los saltos de Windows. */
function splitLines(text: string): string[] {
  const lines = text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

const contextRow = (oldLine: number, newLine: number, text: string): DiffRow => {
  const left: DiffCell = { line: oldLine, text, kind: 'context' };
  const right: DiffCell = { line: newLine, text, kind: 'context' };
  return { left, right };
};

/**
 * Arma el archivo entero como un único segmento: las líneas que el diff no toca van como contexto y las
 * que toca, tal como las trae el diff. Solo hace falta la versión nueva del archivo (`newText`): lo de
 * antes sale de deshacer los cambios del diff, porque fuera de los segmentos ambas versiones son iguales.
 * Para un archivo añadido o eliminado el diff ya trae todo el contenido, así que se pasa `null`.
 *
 * Lanza `FullFileMismatchError` si el archivo no calza con el diff.
 */
export function buildFullHunk(file: DiffFile, newText: string | null): DiffHunk {
  const header = 'Archivo completo';
  if (newText === null) return { header, rows: file.hunks.flatMap((hunk) => hunk.rows) };

  const newLines = splitLines(newText);
  const rows: DiffRow[] = [];
  let oldLine = 1;
  let newLine = 1;

  const addContext = (count: number) => {
    for (let i = 0; i < count; i++) {
      const text = newLines[newLine - 1];
      if (text === undefined) throw new FullFileMismatchError();
      rows.push(contextRow(oldLine++, newLine++, text));
    }
  };

  for (const hunk of file.hunks) {
    const match = HUNK_HEADER.exec(hunk.header);
    if (!match) throw new FullFileMismatchError();

    const oldCount = match[2] === undefined ? 1 : Number(match[2]);
    const newCount = match[4] === undefined ? 1 : Number(match[4]);
    // Con 0 líneas el número del encabezado es el de la línea anterior al cambio.
    const oldStart = oldCount === 0 ? Number(match[1]) + 1 : Number(match[1]);
    const newStart = newCount === 0 ? Number(match[3]) + 1 : Number(match[3]);

    const gap = newStart - newLine;
    if (gap < 0 || gap !== oldStart - oldLine) throw new FullFileMismatchError();
    addContext(gap);

    for (const row of hunk.rows) {
      if (row.right && newLines[row.right.line - 1] !== row.right.text) {
        throw new FullFileMismatchError();
      }
      rows.push(row);
    }
    oldLine = oldStart + oldCount;
    newLine = newStart + newCount;
  }

  const remaining = newLines.length - (newLine - 1);
  if (remaining < 0) throw new FullFileMismatchError();
  addContext(remaining);

  return { header, rows };
}
