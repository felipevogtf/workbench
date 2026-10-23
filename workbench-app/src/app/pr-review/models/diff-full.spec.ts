import { parseUnifiedDiff } from './diff';
import { buildFullHunk, FullFileMismatchError } from './diff-full';

const numbered = (count: number, replace: Record<number, string> = {}) =>
  Array.from({ length: count }, (_, i) => replace[i + 1] ?? `line ${i + 1}`).join('\n') + '\n';

/** Un archivo de 12 líneas donde la 5 pasó a ser «changed 5» y se añadió «extra» tras la 8. */
const NEW_TEXT = numbered(13, {
  5: 'changed 5',
  9: 'extra',
  10: 'line 9',
  11: 'line 10',
  12: 'line 11',
  13: 'line 12',
});

const DIFF = `diff --git a/f.txt b/f.txt
--- a/f.txt
+++ b/f.txt
@@ -3,5 +3,5 @@
 line 3
 line 4
-line 5
+changed 5
 line 6
 line 7
@@ -8,2 +8,3 @@
 line 8
+extra
 line 9
`;

describe('buildFullHunk', () => {
  const [file] = parseUnifiedDiff(DIFF);

  it('shows every line of the file, with the changes of the diff in their place', () => {
    const { rows, header } = buildFullHunk(file, NEW_TEXT);

    expect(header).toBe('Archivo completo');
    // 12 líneas antes y 13 después: una más por la línea añadida.
    expect(rows).toHaveLength(13);
    expect(rows.filter((r) => r.left && r.right && r.left.kind === 'context')).toHaveLength(11);
    expect(rows[4].left).toEqual({ line: 5, text: 'line 5', kind: 'del' });
    expect(rows[4].right).toEqual({ line: 5, text: 'changed 5', kind: 'add' });
    expect(rows[8].left).toBeNull();
    expect(rows[8].right).toEqual({ line: 9, text: 'extra', kind: 'add' });
  });

  it('numbers both sides continuously, also after a line was added', () => {
    const { rows } = buildFullHunk(file, NEW_TEXT);
    const last = rows[rows.length - 1];

    expect(rows[0].left?.line).toBe(1);
    expect(rows[0].right?.line).toBe(1);
    expect(last.left?.line).toBe(12);
    expect(last.right?.line).toBe(13);
    expect(last.right?.text).toBe('line 12');
  });

  it('reconstructs the old file from the new one', () => {
    const { rows } = buildFullHunk(file, NEW_TEXT);
    const old = rows.flatMap((r) => (r.left ? [r.left.text] : []));

    expect(old).toEqual(Array.from({ length: 12 }, (_, i) => `line ${i + 1}`));
  });

  it('takes the lines of an added or deleted file from the diff itself', () => {
    const [added, deleted] = parseUnifiedDiff(`diff --git a/n.txt b/n.txt
new file mode 100644
--- /dev/null
+++ b/n.txt
@@ -0,0 +1,2 @@
+one
+two
diff --git a/o.txt b/o.txt
deleted file mode 100644
--- a/o.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-gone
-too
`);

    expect(buildFullHunk(added, null).rows.map((r) => r.right?.text)).toEqual(['one', 'two']);
    expect(buildFullHunk(deleted, null).rows.map((r) => r.left?.text)).toEqual(['gone', 'too']);
  });

  it('handles a change at the very start and a file without a final newline', () => {
    const [first] = parseUnifiedDiff(`diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -1,2 +1,2 @@
-old
+new
 keep
`);

    const { rows } = buildFullHunk(first, 'new\nkeep\nrest');

    expect(rows.map((r) => r.right?.text)).toEqual(['new', 'keep', 'rest']);
    expect(rows[2].left).toEqual({ line: 3, text: 'rest', kind: 'context' });
  });

  it('copes with a hunk that only deletes lines (new side with zero lines)', () => {
    const [only] = parseUnifiedDiff(`diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -2,1 +1,0 @@
-gone
`);

    const { rows } = buildFullHunk(only, 'first\nlast\n');

    expect(rows.map((r) => [r.left?.text ?? null, r.right?.text ?? null])).toEqual([
      ['first', 'first'],
      ['gone', null],
      ['last', 'last'],
    ]);
  });

  it('reads Windows line breaks', () => {
    const { rows } = buildFullHunk(file, NEW_TEXT.replace(/\n/g, '\r\n'));

    expect(rows[4].right?.text).toBe('changed 5');
  });

  it('refuses a file that no longer matches the diff', () => {
    expect(() => buildFullHunk(file, numbered(13))).toThrow(FullFileMismatchError);
    expect(() => buildFullHunk(file, 'too short\n')).toThrow(FullFileMismatchError);
  });
});
