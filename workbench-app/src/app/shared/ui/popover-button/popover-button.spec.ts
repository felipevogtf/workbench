import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PopoverButton } from './popover-button';

@Component({
  imports: [PopoverButton],
  template: `
    <app-popover-button label="Filtros">
      <p class="inside">Contenido</p>
    </app-popover-button>
  `,
})
class Host {}

describe('PopoverButton', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button.popover__trigger',
    )!;
    const panel = () => document.querySelector('.popover__panel');
    const flush = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, button, panel, flush };
  }

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  it('has an accessible name and starts closed', async () => {
    const { button, panel } = await setup();

    expect(button.getAttribute('aria-label')).toBe('Filtros');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(panel()).toBeNull();
  });

  it('opens the panel with the projected content and closes it on a second click', async () => {
    const { button, panel, flush } = await setup();

    button.click();
    await flush();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel()?.querySelector('.inside')?.textContent).toBe('Contenido');

    button.click();
    await flush();
    expect(panel()).toBeNull();
  });

  it('closes with Escape and when clicking outside, but not when clicking inside', async () => {
    const { button, panel, flush } = await setup();

    button.click();
    await flush();
    panel()!.querySelector<HTMLElement>('.inside')!.click();
    await flush();
    expect(panel()).not.toBeNull();

    document.body.click();
    await flush();
    expect(panel()).toBeNull();

    button.click();
    await flush();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(panel()).toBeNull();
  });
});
