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
    const rows = Array.from(element.querySelectorAll('tbody tr'));
    const cells = (row: Element) =>
      Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.trim());

    expect(element.querySelector('.hunk__header')?.textContent).toBe('@@ -1,2 +1,2 @@');
    expect(rows).toHaveLength(3);
    expect(cells(rows[1])).toEqual(['2', 'before', '2', 'after']);
    expect(cells(rows[2])).toEqual(['', '', '3', 'extra']);
  });

  it('marks removed, added and missing lines so they can be colored', async () => {
    const element = await render();
    const kinds = Array.from(element.querySelectorAll('tbody tr:nth-child(2) td')).map((td) =>
      td.getAttribute('data-kind'),
    );
    const missing = element.querySelector('tbody tr:nth-child(3) td')?.getAttribute('data-kind');

    expect(kinds).toEqual(['del', 'del', 'add', 'add']);
    expect(missing).toBe('empty');
  });
});
