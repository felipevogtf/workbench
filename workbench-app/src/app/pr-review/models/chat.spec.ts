import { DiffFile, DiffHunk } from './diff';
import { buildExplainMessage, hunkAsDiff } from './chat';

const hunk: DiffHunk = {
  header: '@@ -1,4 +1,4 @@ function main',
  rows: [
    {
      left: { line: 1, text: 'const a = 1;', kind: 'context' },
      right: { line: 1, text: 'const a = 1;', kind: 'context' },
    },
    {
      left: { line: 2, text: 'const b = 2;', kind: 'del' },
      right: { line: 2, text: 'const b = 20;', kind: 'add' },
    },
    {
      left: { line: 3, text: 'const c = 3;', kind: 'del' },
      right: { line: 3, text: 'const c = 30;', kind: 'add' },
    },
    { left: null, right: { line: 4, text: 'const d = 40;', kind: 'add' } },
    {
      left: { line: 4, text: 'return a;', kind: 'context' },
      right: { line: 5, text: 'return a;', kind: 'context' },
    },
  ],
};

const file: DiffFile = {
  path: 'src/a.ts',
  oldPath: 'src/a.ts',
  status: 'modified',
  binary: false,
  additions: 3,
  deletions: 2,
  hunks: [hunk],
};

describe('hunkAsDiff', () => {
  it('writes the segment as a diff, with the removed lines before the added ones of each block', () => {
    expect(hunkAsDiff(hunk)).toBe(
      [
        '@@ -1,4 +1,4 @@ function main',
        ' const a = 1;',
        '-const b = 2;',
        '-const c = 3;',
        '+const b = 20;',
        '+const c = 30;',
        '+const d = 40;',
        ' return a;',
      ].join('\n'),
    );
  });
});

describe('buildExplainMessage', () => {
  it('asks for an explanation of the segment, naming the file and what happened to it', () => {
    const message = buildExplainMessage(file, hunk);

    expect(message).toContain('Explícame qué hace este segmento de código del archivo `src/a.ts`');
    expect(message).toContain('(modificado en esta PR)');
    expect(message).toContain('```diff\n@@ -1,4 +1,4 @@ function main');
    expect(message.trimEnd().endsWith('```')).toBe(true);
  });

  it('uses a longer fence when the code has code fences of its own', () => {
    const withFence: DiffHunk = {
      header: '@@ -1 +1 @@',
      rows: [{ left: null, right: { line: 1, text: '```js', kind: 'add' } }],
    };

    const message = buildExplainMessage(file, withFence);

    expect(message).toContain('````diff');
    expect(message.trimEnd().endsWith('````')).toBe(true);
  });

  it('cuts a huge segment instead of sending it whole', () => {
    const huge: DiffHunk = {
      header: '@@ -0,0 +1,1 @@',
      rows: [{ left: null, right: { line: 1, text: 'x'.repeat(50_000), kind: 'add' } }],
    };

    const message = buildExplainMessage(file, huge);

    expect(message).toContain('…(recortado)');
    expect(message.length).toBeLessThan(21_000);
  });
});
