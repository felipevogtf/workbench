import { TestBed } from '@angular/core/testing';
import { DiffFile as File } from '../../models/diff';
import { FullFileState } from '../../models/diff-full';
import { DiffFile } from './diff-file';

const file: File = {
  path: 'a.ts',
  oldPath: 'a.ts',
  status: 'modified',
  binary: false,
  additions: 2,
  deletions: 1,
  hunks: [
    {
      header: '@@ -1,2 +1,3 @@',
      rows: [
        {
          left: { line: 1, text: 'keep', kind: 'context' },
          right: { line: 1, text: 'keep', kind: 'context' },
        },
        {
          left: { line: 2, text: 'old', kind: 'del' },
          right: { line: 2, text: 'new', kind: 'add' },
        },
        { left: null, right: { line: 3, text: 'extra', kind: 'add' } },
      ],
    },
  ],
};

const fullHunk = {
  header: 'Archivo completo',
  rows: [
    {
      left: { line: 1, text: 'before the change', kind: 'context' as const },
      right: { line: 1, text: 'before the change', kind: 'context' as const },
    },
    ...file.hunks[0].rows,
  ],
};

describe('DiffFile views', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(DiffFile);
    fixture.componentRef.setInput('file', file);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    return fixture;
  }

  const element = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const cells = (row: Element) => Array.from(row.children).map((c) => c.textContent?.trim());

  describe('full file', () => {
    const toggle = (host: HTMLElement) =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('.file__meta button')).find((b) =>
        /Archivo completo|Solo cambios/.test(b.textContent ?? ''),
      )!;

    it('asks for the content when the button is pressed and says it is loading', async () => {
      const fixture = await render();
      const requested = vi.fn();
      fixture.componentInstance.fullRequested.subscribe(requested);

      toggle(element(fixture)).click();
      await fixture.whenStable();

      expect(requested).toHaveBeenCalledTimes(1);
      expect(element(fixture).querySelector('.file__loading')).not.toBeNull();
      expect(element(fixture).querySelector('.rows')).toBeNull();
    });

    it('shows every line of the file once it is loaded, and goes back to the changes', async () => {
      const fixture = await render({ fullState: { status: 'ready', hunk: fullHunk } });

      toggle(element(fixture)).click();
      await fixture.whenStable();
      const rows = Array.from(element(fixture).querySelectorAll('.row'));

      expect(rows).toHaveLength(4);
      expect(cells(rows[0])).toEqual(['1', 'before the change', '1', 'before the change']);
      expect(element(fixture).querySelector('.hunk__header')?.textContent).toBe('Archivo completo');
      expect(toggle(element(fixture)).textContent).toContain('Solo cambios');
      // Explicar con IA es por segmento: no tiene sentido sobre el archivo entero.
      expect(element(fixture).querySelector('.hunk__ai')).toBeNull();

      toggle(element(fixture)).click();
      await fixture.whenStable();

      expect(element(fixture).querySelectorAll('.row')).toHaveLength(3);
      expect(element(fixture).querySelector('.hunk__ai')).not.toBeNull();
    });

    it('shows why the file could not be loaded and lets the user try again', async () => {
      const state: FullFileState = { status: 'error', message: 'El archivo cambió' };
      const fixture = await render({ fullState: state });
      const requested = vi.fn();
      fixture.componentInstance.fullRequested.subscribe(requested);

      toggle(element(fixture)).click();
      await fixture.whenStable();
      expect(requested).toHaveBeenCalledTimes(1);

      const note = element(fixture).querySelector('.file__note[role="alert"]')!;
      expect(note.textContent).toContain('El archivo cambió');
      note.querySelector('button')!.click();
      expect(requested).toHaveBeenCalledTimes(2);
    });

    it('has no button for a file without content to show', async () => {
      const fixture = await render({ file: { ...file, binary: true } });

      expect(toggle(element(fixture))).toBeUndefined();
    });
  });

  describe('independent scroll', () => {
    it('keeps both sides aligned, with their empty rows, until it is turned on', async () => {
      const fixture = await render();

      expect(element(fixture).querySelectorAll('.pane')).toHaveLength(0);
      expect(element(fixture).querySelectorAll('.row')).toHaveLength(3);
      expect(element(fixture).querySelector('.file__sync')).not.toBeNull();
    });

    it('splits the sides into two panes that only have their own lines', async () => {
      const fixture = await render({ independentScroll: true });
      const [oldPane, newPane] = Array.from(element(fixture).querySelectorAll('.pane'));

      expect(Array.from(oldPane.querySelectorAll('.row')).map(cells)).toEqual([
        ['1', 'keep'],
        ['2', 'old'],
      ]);
      expect(Array.from(newPane.querySelectorAll('.row')).map(cells)).toEqual([
        ['1', 'keep'],
        ['2', 'new'],
        ['3', 'extra'],
      ]);
      expect(element(fixture).classList.contains('is-independent')).toBe(true);
    });

    it('moves the divider as a plain percentage of the width', async () => {
      const fixture = await render({ independentScroll: true });
      const box = element(fixture).querySelector<HTMLElement>('.file__hunks')!;
      vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        width: 400,
      } as DOMRect);

      (fixture.componentInstance as unknown as { drag(x: number): void }).drag(300);

      expect(fixture.componentInstance.split()).toBe(50);
    });

    it('has nothing to unsynchronize in an added file', async () => {
      const fixture = await render({ file: { ...file, status: 'added' } });

      expect(element(fixture).querySelector('.file__sync')).toBeNull();
      expect(element(fixture).classList.contains('is-independent')).toBe(false);
    });
  });
});
