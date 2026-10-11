import { TestBed } from '@angular/core/testing';
import { Toast } from '@shared/ui/toast/toast';
import { PasswordGenerator } from './password-generator';

describe('PasswordGenerator', () => {
  async function render() {
    const fixture = TestBed.createComponent(PasswordGenerator);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      root,
      password: () => root.querySelector('.result__password')!.textContent!.trim(),
      label: () => root.querySelector('.strength__label')!.textContent!.trim(),
      checkbox: (name: string) =>
        root.querySelector<HTMLInputElement>(
          `app-checkbox[formcontrolname="${name}"] input[type="checkbox"]`,
        )!,
      async change(input: HTMLInputElement, apply: (input: HTMLInputElement) => void) {
        apply(input);
        input.dispatchEvent(new Event(input.type === 'range' ? 'input' : 'change'));
        await fixture.whenStable();
      },
    };
  }

  it('starts with a 16 character password and a very secure rating', async () => {
    const view = await render();

    expect(view.password()).toHaveLength(16);
    expect(view.label()).toBe('Muy segura');
  });

  it('follows the length slider', async () => {
    const view = await render();
    const slider = view.root.querySelector<HTMLInputElement>('#generator-length')!;

    await view.change(slider, (input) => (input.value = '24'));

    expect(view.password()).toHaveLength(24);
    expect(view.root.querySelector('.length__value')!.textContent).toContain('24');
  });

  it('gives another password on request', async () => {
    const view = await render();
    const before = view.password();

    view.root.querySelector<HTMLButtonElement>('button[label="Generar otra contraseña"]')!.click();
    await view.fixture.whenStable();

    expect(view.password()).not.toBe(before);
    expect(view.password()).toHaveLength(16);
  });

  it('uses only the sets that stay checked', async () => {
    const view = await render();

    for (const name of ['uppercase', 'digits', 'symbols']) {
      await view.change(view.checkbox(name), (input) => (input.checked = false));
    }

    expect(view.password()).toMatch(/^[a-z]{16}$/);
  });

  it('does not let the last character set be unchecked', async () => {
    const view = await render();

    for (const name of ['uppercase', 'digits', 'symbols']) {
      await view.change(view.checkbox(name), (input) => (input.checked = false));
    }

    expect(view.checkbox('lowercase').disabled).toBe(true);
    await view.change(view.checkbox('digits'), (input) => (input.checked = true));
    expect(view.checkbox('lowercase').disabled).toBe(false);
  });

  it('copies the password that is on screen', async () => {
    const view = await render();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const success = vi.spyOn(TestBed.inject(Toast), 'success');

    const copy = [...view.root.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Copiar'),
    )!;
    copy.click();

    await vi.waitFor(() => expect(success).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(view.password());
    vi.unstubAllGlobals();
  });
});
