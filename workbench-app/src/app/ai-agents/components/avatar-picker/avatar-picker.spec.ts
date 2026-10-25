import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarPicker } from './avatar-picker';
import { AVATAR_RESIZER } from './resize-image';

const resize = vi.fn();

async function render(value: string | null = null) {
  const fixture = TestBed.createComponent(AvatarPicker);
  fixture.componentRef.setInput('name', 'David');
  fixture.componentRef.setInput('value', value);
  await fixture.whenStable();
  return fixture;
}

function choose(element: HTMLElement, file: File): void {
  const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('AvatarPicker', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [{ provide: AVATAR_RESIZER, useValue: resize }] }),
  );

  it('offers to upload when there is no image, and to change or remove it when there is one', async () => {
    const empty = (await render()).nativeElement as HTMLElement;
    expect(empty.textContent).toContain('Subir imagen');
    expect(empty.textContent).not.toContain('Quitar');

    const filled = (await render('data:image/webp;base64,AAAA')).nativeElement as HTMLElement;
    expect(filled.textContent).toContain('Cambiar imagen');
    expect(filled.textContent).toContain('Quitar');
  });

  it('takes the resized image of the chosen file as its value', async () => {
    resize.mockResolvedValue('data:image/webp;base64,BBBB');
    const fixture = await render();

    choose(fixture.nativeElement, new File(['x'], 'foto.png', { type: 'image/png' }));
    await vi.waitFor(() =>
      expect(fixture.componentInstance.value()).toBe('data:image/webp;base64,BBBB'),
    );
  });

  it('rejects a file that is not an image', async () => {
    const fixture = await render();

    choose(fixture.nativeElement, new File(['x'], 'nota.txt', { type: 'text/plain' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'no es una imagen',
    );
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('removes the image', async () => {
    const fixture = await render('data:image/webp;base64,AAAA');

    const remove = [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Quitar'),
    ) as HTMLButtonElement;
    remove.click();

    expect(fixture.componentInstance.value()).toBeNull();
  });
});
