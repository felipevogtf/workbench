import { DiffFile } from './diff';

export interface DirNode {
  kind: 'dir';
  /** Ruta completa de la carpeta; identifica la carpeta al plegarla. */
  path: string;
  /** Lo que se muestra: una cadena de carpetas sin archivos propios se junta (`src/app/shared`). */
  name: string;
  children: TreeNode[];
}

export interface FileNode {
  kind: 'file';
  name: string;
  file: DiffFile;
}

export type TreeNode = DirNode | FileNode;

/** Una fila ya aplanada del árbol, lista para dibujarse con su sangría. */
export type TreeRow =
  | { kind: 'dir'; key: string; depth: number; name: string; expanded: boolean }
  | { kind: 'file'; key: string; depth: number; name: string; file: DiffFile };

interface Folder {
  folders: Map<string, Folder>;
  files: FileNode[];
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Agrupa los archivos por carpeta. Primero van las carpetas y luego los archivos, cada grupo en orden
 * alfabético, y las carpetas que solo contienen otra carpeta se compactan en una sola fila.
 */
export function buildFileTree(files: readonly DiffFile[]): TreeNode[] {
  const root: Folder = { folders: new Map(), files: [] };

  for (const file of files) {
    const segments = file.path.split('/');
    const name = segments.pop() ?? file.path;
    let folder = root;
    for (const segment of segments) {
      let next = folder.folders.get(segment);
      if (!next) {
        next = { folders: new Map(), files: [] };
        folder.folders.set(segment, next);
      }
      folder = next;
    }
    folder.files.push({ kind: 'file', name, file });
  }

  return toNodes(root, '');
}

function toNodes(folder: Folder, parentPath: string): TreeNode[] {
  const dirs: DirNode[] = [...folder.folders].map(([name, child]) => {
    let path = parentPath ? `${parentPath}/${name}` : name;
    let label = name;
    let node = child;
    // Carpeta sin archivos propios y con una sola subcarpeta: se une con ella.
    while (node.files.length === 0 && node.folders.size === 1) {
      const [[childName, grandchild]] = node.folders;
      path = `${path}/${childName}`;
      label = `${label}/${childName}`;
      node = grandchild;
    }
    return { kind: 'dir', path, name: label, children: toNodes(node, path) };
  });

  return [...dirs.sort(byName), ...[...folder.files].sort(byName)];
}

/** Los archivos en el orden en que se ven en el árbol. */
export function treeOrder(nodes: readonly TreeNode[]): DiffFile[] {
  return nodes.flatMap((node) => (node.kind === 'file' ? [node.file] : treeOrder(node.children)));
}

/** Filas visibles del árbol: lo que cuelga de una carpeta plegada no aparece. */
export function flattenTree(
  nodes: readonly TreeNode[],
  collapsed: ReadonlySet<string>,
  depth = 0,
): TreeRow[] {
  return nodes.flatMap((node): TreeRow[] => {
    if (node.kind === 'file') {
      return [{ kind: 'file', key: node.file.path, depth, name: node.name, file: node.file }];
    }
    const expanded = !collapsed.has(node.path);
    const row: TreeRow = { kind: 'dir', key: node.path, depth, name: node.name, expanded };
    return expanded ? [row, ...flattenTree(node.children, collapsed, depth + 1)] : [row];
  });
}
