export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed';

export type DiffCellKind = 'context' | 'add' | 'del';

/** Una línea de código en uno de los dos lados. */
export interface DiffCell {
  line: number;
  text: string;
  kind: DiffCellKind;
}

/** Una fila de la vista lado a lado. Un lado es null cuando el otro tiene líneas de más. */
export interface DiffRow {
  left: DiffCell | null;
  right: DiffCell | null;
}

export interface DiffHunk {
  /** La línea `@@ -a,b +c,d @@ …` tal como viene. */
  header: string;
  rows: DiffRow[];
}

export interface DiffFile {
  path: string;
  /** Ruta antes del cambio; distinta de `path` solo si se renombró. */
  oldPath: string;
  status: DiffFileStatus;
  binary: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export const DIFF_STATUS_LABEL: Record<DiffFileStatus, string> = {
  added: 'Añadido',
  deleted: 'Eliminado',
  modified: 'Modificado',
  renamed: 'Renombrado',
};

const FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Convierte un diff unificado (el de `git diff`, que entregan GitHub y Bitbucket) en archivos con sus
 * hunks ya emparejados para la vista lado a lado: las líneas eliminadas van a la izquierda, las
 * añadidas a la derecha y el contexto en ambos lados.
 */
export function parseUnifiedDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;
  let oldLeft = 0;
  let newLeft = 0;
  let dels: DiffCell[] = [];
  let adds: DiffCell[] = [];

  // Un bloque de eliminadas y añadidas seguidas se empareja fila a fila.
  const flushChanges = () => {
    if (!hunk) return;
    const count = Math.max(dels.length, adds.length);
    for (let i = 0; i < count; i++) {
      hunk.rows.push({ left: dels[i] ?? null, right: adds[i] ?? null });
    }
    dels = [];
    adds = [];
  };

  for (const raw of text.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    // Dentro de un hunk el contenido manda: una línea eliminada que empiece con "--" no es un encabezado.
    if (file && hunk && (oldLeft > 0 || newLeft > 0)) {
      const marker = line[0];
      if (marker === '\\') continue; // "\ No newline at end of file"

      if (marker === '-') {
        dels.push({ line: oldLine++, text: line.slice(1), kind: 'del' });
        file.deletions++;
        oldLeft--;
      } else if (marker === '+') {
        adds.push({ line: newLine++, text: line.slice(1), kind: 'add' });
        file.additions++;
        newLeft--;
      } else {
        // Algunos diffs recortan el espacio de las líneas de contexto vacías.
        flushChanges();
        const text = marker === ' ' ? line.slice(1) : line;
        hunk.rows.push({
          left: { line: oldLine++, text, kind: 'context' },
          right: { line: newLine++, text, kind: 'context' },
        });
        oldLeft--;
        newLeft--;
      }
      if (oldLeft <= 0 && newLeft <= 0) flushChanges();
      continue;
    }

    const fileHeader = FILE_HEADER.exec(line);
    if (fileHeader) {
      flushChanges();
      hunk = null;
      file = {
        oldPath: fileHeader[1],
        path: fileHeader[2],
        status: 'modified',
        binary: false,
        additions: 0,
        deletions: 0,
        hunks: [],
      };
      files.push(file);
      continue;
    }
    if (!file) continue;

    const hunkHeader = HUNK_HEADER.exec(line);
    if (hunkHeader) {
      flushChanges();
      hunk = { header: line, rows: [] };
      file.hunks.push(hunk);
      oldLine = Number(hunkHeader[1]);
      oldLeft = hunkHeader[2] === undefined ? 1 : Number(hunkHeader[2]);
      newLine = Number(hunkHeader[3]);
      newLeft = hunkHeader[4] === undefined ? 1 : Number(hunkHeader[4]);
    } else if (line.startsWith('new file mode')) {
      file.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      file.status = 'deleted';
    } else if (line.startsWith('rename from ')) {
      file.status = 'renamed';
      file.oldPath = line.slice('rename from '.length);
    } else if (line.startsWith('rename to ')) {
      file.path = line.slice('rename to '.length);
    } else if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      file.binary = true;
    }
  }

  flushChanges();
  return files;
}

export function countRows(file: DiffFile): number {
  return file.hunks.reduce((total, hunk) => total + hunk.rows.length, 0);
}
