import { TestBed } from '@angular/core/testing';
import { DiffHunk as Hunk } from '../../models/diff';
import { DiffHunk } from './diff-hunk';

const hunk: Hunk = {
  header: '@@ -1,2 +1,2 @@',
  rows: [
    {
      left: { line: 1, text: 'same', kind: 'context' },
      right: { line: 1, text: 'same', kind: 'context' },
    },
    {
      left: { line: 2, text: 'before', kind: 'del' },
      right: { line: 2, text: 'after', kind: 'add' },
    },
    { left: null, right: { line: 3, text: 'extra', kind: 'add' } },
  ],
};

describe('DiffHunk', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(DiffHunk);
    fixture.componentRef.setInput('hunk', hunk);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('puts the old code on the left and the new code on the right', async () => {
    const element = await render();
    const rows = Array.from(element.querySelectorAll('.row'));
    const cells = (row: Element) =>
      Array.from(row.children).map((cell) => cell.textContent?.trim());

    expect(element.querySelector('.hunk__header')?.textContent).toBe('@@ -1,2 +1,2 @@');
    expect(rows).toHaveLength(3);
    expect(cells(rows[1])).toEqual(['2', 'before', '2', 'after']);
    expect(cells(rows[2])).toEqual(['', '', '3', 'extra']);
  });

  it('shows a single column of new code for an added file', async () => {
    const fixture = TestBed.createComponent(DiffHunk);
    fixture.componentRef.setInput('hunk', {
      header: '@@ -0,0 +1,2 @@',
      rows: [
        { left: null, right: { line: 1, text: 'one', kind: 'add' } },
        { left: null, right: { line: 2, text: 'two', kind: 'add' } },
      ],
    } satisfies Hunk);
    fixture.componentRef.setInput('mode', 'new');
    await fixture.whenStable();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.row'));

    expect(rows.map((row) => Array.from(row.children).map((c) => c.textContent?.trim()))).toEqual([
      ['1', 'one'],
      ['2', 'two'],
    ]);
  });

  it('shows a single column of old code for a deleted file', async () => {
    const fixture = TestBed.createComponent(DiffHunk);
    fixture.componentRef.setInput('hunk', {
      header: '@@ -1 +0,0 @@',
      rows: [{ left: { line: 1, text: 'gone', kind: 'del' }, right: null }],
    } satisfies Hunk);
    fixture.componentRef.setInput('mode', 'old');
    await fixture.whenStable();
    const row = (fixture.nativeElement as HTMLElement).querySelector('.row')!;

    expect(Array.from(row.children).map((c) => c.textContent?.trim())).toEqual(['1', 'gone']);
  });

  it('leaves out the rows that have nothing on the side it shows', async () => {
    const fixture = TestBed.createComponent(DiffHunk);
    fixture.componentRef.setInput('hunk', hunk);
    fixture.componentRef.setInput('mode', 'old');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.row')).toHaveLength(2);

    fixture.componentRef.setInput('mode', 'new');
    await fixture.whenStable();

    expect(root.querySelectorAll('.row')).toHaveLength(3);
  });

  it('marks removed, added and missing lines so they can be colored', async () => {
    const element = await render();
    const kinds = Array.from(element.querySelectorAll('.row:nth-child(2) > *')).map((cell) =>
      cell.getAttribute('data-kind'),
    );
    const missing = element.querySelector('.row:nth-child(3) > *')?.getAttribute('data-kind');

    expect(kinds).toEqual(['del', 'del', 'add', 'add']);
    expect(missing).toBe('empty');
  });
});
