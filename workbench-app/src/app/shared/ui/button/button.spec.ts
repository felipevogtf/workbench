import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from './button';

@Component({
  imports: [Button],
  template: `
    <button app-button id="plain">Guardar</button>
    <button app-button id="loading" loading>Guardando</button>
    <button app-button id="off" disabled variant="secondary">Off</button>
  `,
})
class Host {}

describe('Button', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('is enabled by default and shows its variant', async () => {
    const button = (await render()).querySelector<HTMLButtonElement>('#plain')!;

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('data-variant')).toBe('primary');
  });

  it('is disabled and busy while loading, with a spinner', async () => {
    const button = (await render()).querySelector<HTMLButtonElement>('#loading')!;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('app-spinner')).not.toBeNull();
  });

  it('can be disabled explicitly', async () => {
    const button = (await render()).querySelector<HTMLButtonElement>('#off')!;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('data-variant')).toBe('secondary');
  });
});
