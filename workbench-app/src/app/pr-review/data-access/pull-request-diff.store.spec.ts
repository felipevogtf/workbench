import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PullRequestDetail } from '../models/pull-request';
import { PullRequestDiffStore } from './pull-request-diff.store';
import { PullRequestsApi } from './pull-requests.api';

const DIFF = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1 +1,2 @@
 keep
+added
diff --git a/b.ts b/b.ts
--- a/b.ts
+++ b/b.ts
@@ -1 +1 @@
-old
+new
`;

const detail = { id: 'p1', title: 'PR 1', reviews: [] } as unknown as PullRequestDetail;

describe('PullRequestDiffStore', () => {
  let api: {
    get: ReturnType<typeof vi.fn>;
    diff: ReturnType<typeof vi.fn>;
    file: ReturnType<typeof vi.fn>;
  };
  let store: PullRequestDiffStore;

  beforeEach(() => {
    api = {
      get: vi.fn(() => of(detail)),
      diff: vi.fn(() => of(DIFF)),
      file: vi.fn(() => of('keep\nadded\n')),
    };
    TestBed.configureTestingModule({
      providers: [PullRequestDiffStore, { provide: PullRequestsApi, useValue: api }],
    });
    store = TestBed.inject(PullRequestDiffStore);
  });

  it('loads the pull request and its parsed files, selecting the first one', async () => {
    await store.load('p1');

    expect(store.detail()).toBe(detail);
    expect(store.files().map((f) => f.path)).toEqual(['a.ts', 'b.ts']);
    expect(store.selected()?.path).toBe('a.ts');
    expect(store.additions()).toBe(2);
    expect(store.deletions()).toBe(1);
  });

  it('selects the first file of the folder tree, not the first of the diff', async () => {
    api.diff.mockReturnValue(
      of(`diff --git a/root.ts b/root.ts
--- a/root.ts
+++ b/root.ts
@@ -1 +1 @@
-a
+b
diff --git a/src/inner.ts b/src/inner.ts
--- a/src/inner.ts
+++ b/src/inner.ts
@@ -1 +1 @@
-a
+b
`),
    );

    await store.load('p1');

    expect(store.files()[0].path).toBe('root.ts');
    expect(store.selected()?.path).toBe('src/inner.ts');
  });

  it('shows the file that was picked', async () => {
    await store.load('p1');

    store.select('b.ts');

    expect(store.selected()?.path).toBe('b.ts');
  });

  it('exposes the error when the diff cannot be read', async () => {
    api.diff.mockReturnValue(throwError(() => new Error('boom')));

    await store.load('p1');

    expect(store.error()).toBeTruthy();
    expect(store.detail()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  describe('full file', () => {
    it('asks the provider for the new version of a modified file and builds every line', async () => {
      await store.load('p1');
      const file = store.files()[0];

      await store.loadFull(file);

      expect(api.file).toHaveBeenCalledWith('p1', 'a.ts');
      expect(store.fullState()).toMatchObject({ status: 'ready' });
      const state = store.fullState();
      expect(state?.status === 'ready' && state.hunk.rows.map((r) => r.right?.text)).toEqual([
        'keep',
        'added',
      ]);
    });

    it('does not ask again for a file that is already loaded', async () => {
      await store.load('p1');
      const file = store.files()[0];

      await store.loadFull(file);
      await store.loadFull(file);

      expect(api.file).toHaveBeenCalledTimes(1);
    });

    it('takes an added file from the diff, without asking the provider', async () => {
      api.diff.mockReturnValue(
        of(`diff --git a/n.ts b/n.ts
new file mode 100644
--- /dev/null
+++ b/n.ts
@@ -0,0 +1,1 @@
+one
`),
      );
      await store.load('p1');

      await store.loadFull(store.files()[0]);

      expect(api.file).not.toHaveBeenCalled();
      expect(store.fullState()).toMatchObject({ status: 'ready' });
    });

    it('explains that the file changed when it no longer matches the diff, and can try again', async () => {
      api.file.mockReturnValueOnce(of('something else entirely\n'));
      await store.load('p1');
      const file = store.files()[0];

      await store.loadFull(file);

      expect(store.fullState()).toMatchObject({
        status: 'error',
        message: expect.stringContaining('cambió') as string,
      });

      await store.loadFull(file);

      expect(store.fullState()).toMatchObject({ status: 'ready' });
    });

    it('reports a failure of the provider', async () => {
      api.file.mockReturnValueOnce(throwError(() => new Error('boom')));
      await store.load('p1');

      await store.loadFull(store.files()[0]);

      expect(store.fullState()).toMatchObject({ status: 'error' });
    });

    it('forgets the loaded files when the page loads again', async () => {
      await store.load('p1');
      await store.loadFull(store.files()[0]);

      await store.load('p1');

      expect(store.fullState()).toBeNull();
    });
  });
});
