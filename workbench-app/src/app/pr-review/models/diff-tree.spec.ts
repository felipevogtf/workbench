import { DiffFile } from './diff';
import { buildFileTree, flattenTree, treeOrder } from './diff-tree';

function file(path: string): DiffFile {
  return {
    path,
    oldPath: path,
    status: 'modified',
    binary: false,
    additions: 1,
    deletions: 0,
    hunks: [],
  };
}

const describeRows = (rows: ReturnType<typeof flattenTree>) =>
  rows.map((row) => `${'  '.repeat(row.depth)}${row.name}${row.kind === 'dir' ? '/' : ''}`);

describe('buildFileTree', () => {
  const files = [
    file('src/app/b.ts'),
    file('README.md'),
    file('src/app/a.ts'),
    file('src/app/shared/ui/x.ts'),
    file('docker/stubs/files/one.xml'),
    file('docker/stubs/files/two.xml'),
  ];

  it('groups by folder, folders first, and sorts each group by name', () => {
    const rows = flattenTree(buildFileTree(files), new Set());

    expect(describeRows(rows)).toEqual([
      'docker/stubs/files/',
      '  one.xml',
      '  two.xml',
      'src/app/',
      '  shared/ui/',
      '    x.ts',
      '  a.ts',
      '  b.ts',
      'README.md',
    ]);
  });

  it('joins a chain of folders that have no files of their own into a single row', () => {
    const [dir] = buildFileTree([file('a/b/c/x.ts')]);

    expect(dir).toMatchObject({ kind: 'dir', name: 'a/b/c', path: 'a/b/c' });
  });

  it('does not join a folder that has files of its own', () => {
    const rows = flattenTree(buildFileTree([file('a/y.ts'), file('a/b/x.ts')]), new Set());

    expect(describeRows(rows)).toEqual(['a/', '  b/', '    x.ts', '  y.ts']);
  });

  it('hides what hangs from a collapsed folder and flags it as collapsed', () => {
    const rows = flattenTree(buildFileTree(files), new Set(['src/app']));

    expect(describeRows(rows)).toEqual([
      'docker/stubs/files/',
      '  one.xml',
      '  two.xml',
      'src/app/',
      'README.md',
    ]);
    expect(rows.find((row) => row.key === 'src/app')).toMatchObject({ expanded: false });
  });

  it('lists the files in the order they appear in the tree', () => {
    expect(treeOrder(buildFileTree(files)).map((f) => f.path)).toEqual([
      'docker/stubs/files/one.xml',
      'docker/stubs/files/two.xml',
      'src/app/shared/ui/x.ts',
      'src/app/a.ts',
      'src/app/b.ts',
      'README.md',
    ]);
  });
});
