import { TestBed } from '@angular/core/testing';
import { Avatar, avatarColor } from './avatar';

describe('Avatar', () => {
  async function render(name: string, src?: string | null): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', name);
    if (src !== undefined) fixture.componentRef.setInput('src', src);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the initial of the name when there is no image', async () => {
    const element = await render('david');

    expect(element.textContent?.trim()).toBe('D');
    expect(element.querySelector('img')).toBeNull();
  });

  it('shows the image when there is one', async () => {
    const element = await render('David', 'data:image/png;base64,AAAA');

    expect(element.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(element.textContent?.trim()).toBe('');
  });

  it('keeps the name out of the accessibility tree: the name is already next to it', async () => {
    const element = await render('Lucy');

    expect(element.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.getAttribute('title')).toBeNull();
  });

  it('has the color of the characters it knows, whatever the case', () => {
    expect(avatarColor('Lucy')).toBe(avatarColor('  lucy '));
    expect(avatarColor('David')).toBe('#facc15');
    expect(
      new Set(['Lucy', 'David', 'Maine', 'Rebecca', 'Kiwi', 'Pilar'].map(avatarColor)).size,
    ).toBe(6);
  });

  it('gives any other name a stable color', () => {
    expect(avatarColor('Un trabajador')).toBe(avatarColor('Un trabajador'));
    expect(avatarColor('Un trabajador')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
