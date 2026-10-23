import { countRows, parseUnifiedDiff } from './diff';

const MODIFIED = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,4 +1,5 @@ function main
 const a = 1;
-const b = 2;
-const c = 3;
+const b = 20;
+const c = 30;
+const d = 40;
 return a;
`;

describe('parseUnifiedDiff', () => {
  it('pairs removed and added lines side by side and keeps the context on both sides', () => {
    const [file] = parseUnifiedDiff(MODIFIED);
    const rows = file.hunks[0].rows;

    expect(file.path).toBe('src/a.ts');
    expect(file.status).toBe('modified');
    expect(file.additions).toBe(3);
    expect(file.deletions).toBe(2);
    expect(rows).toHaveLength(5);
    expect(rows[0].left).toEqual({ line: 1, text: 'const a = 1;', kind: 'context' });
    expect(rows[0].right).toEqual({ line: 1, text: 'const a = 1;', kind: 'context' });
    expect(rows[1].left).toEqual({ line: 2, text: 'const b = 2;', kind: 'del' });
    expect(rows[1].right).toEqual({ line: 2, text: 'const b = 20;', kind: 'add' });
    expect(rows[3].left).toBeNull();
    expect(rows[3].right).toEqual({ line: 4, text: 'const d = 40;', kind: 'add' });
    expect(rows[4].left?.line).toBe(4);
    expect(rows[4].right?.line).toBe(5);
  });

  it('keeps the hunk header with its section name', () => {
    const [file] = parseUnifiedDiff(MODIFIED);

    expect(file.hunks[0].header).toBe('@@ -1,4 +1,5 @@ function main');
  });

  it('reads added, deleted and renamed files', () => {
    const files = parseUnifiedDiff(`diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+one
+two
diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1 +0,0 @@
-gone
diff --git a/before.ts b/after.ts
similarity index 100%
rename from before.ts
rename to after.ts
`);

    expect(files.map((f) => f.status)).toEqual(['added', 'deleted', 'renamed']);
    expect(files[0].hunks[0].rows.map((r) => r.left)).toEqual([null, null]);
    expect(files[1].hunks[0].rows[0].right).toBeNull();
    expect(files[2].oldPath).toBe('before.ts');
    expect(files[2].path).toBe('after.ts');
    expect(files[2].hunks).toEqual([]);
  });

  it('does not take a removed line that starts with dashes for a file header', () => {
    const [file] = parseUnifiedDiff(`diff --git a/a.sql b/a.sql
--- a/a.sql
+++ b/a.sql
@@ -1,2 +1,2 @@
--- comment
+-- new comment
 select 1;
`);

    expect(file.deletions).toBe(1);
    expect(file.hunks[0].rows[0].left?.text).toBe('-- comment');
    expect(file.hunks[0].rows[0].right?.text).toBe('-- new comment');
  });

  it('flags binary files and ignores the no-newline marker', () => {
    const files = parseUnifiedDiff(`diff --git a/logo.png b/logo.png
Binary files a/logo.png and b/logo.png differ
diff --git a/b.txt b/b.txt
--- a/b.txt
+++ b/b.txt
@@ -1 +1 @@
-old
\\ No newline at end of file
+new
\\ No newline at end of file
`);

    expect(files[0].binary).toBe(true);
    expect(files[1].hunks[0].rows).toHaveLength(1);
    expect(countRows(files[1])).toBe(1);
  });

  it('returns nothing for an empty diff', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });
});
