import { TestBed } from '@angular/core/testing';
import { DiffFile as File } from '../../models/diff';
import { DiffFile } from './diff-file';

const file: File = {
  path: 'a.ts',
  oldPath: 'a.ts',
  status: 'modified',
  binary: false,
  additions: 1,
  deletions: 1,
  hunks: [
    {
      header: '@@ -1 +1 @@',
      rows: [
        {
          left: { line: 1, text: 'old', kind: 'del' },
          right: { line: 1, text: 'new', kind: 'add' },
        },
      ],
    },
  ],
};

describe('DiffFile split', () => {
  async function render() {
    const fixture = TestBed.createComponent(DiffFile);
    fixture.componentRef.setInput('file', file);
    await fixture.whenStable();
    return fixture;
  }

  it('shares the width equally by default and exposes it to the hunks', async () => {
    const fixture = await render();

    expect(fixture.componentInstance.split()).toBe(50);
    expect((fixture.nativeElement as HTMLElement).style.getPropertyValue('--split')).toBe('50');
  });

  it('moves the divider with the arrow keys', async () => {
    const fixture = await render();
    const handle = (fixture.nativeElement as HTMLElement).querySelector('app-split-handle')!;

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.split()).toBe(52);

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.split()).toBe(48);
  });

  it('never lets either side shrink past its limit', async () => {
    const fixture = await render();
    const handle = (fixture.nativeElement as HTMLElement).querySelector('app-split-handle')!;

    for (let i = 0; i < 40; i++) {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    }
    await fixture.whenStable();

    expect(fixture.componentInstance.split()).toBe(15);
  });
});
