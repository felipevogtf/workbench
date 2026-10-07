import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SaveDialog } from './save-dialog';

@Component({
  imports: [ReactiveFormsModule, SaveDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-save-dialog
      [(open)]="open"
      heading="Prueba"
      [form]="form"
      [save]="save"
      (opened)="opened = opened + 1"
    >
      <div [formGroup]="form"><input formControlName="name" /></div>
    </app-save-dialog>
  `,
})
class Host {
  readonly open = signal(false);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  opened = 0;
  save = vi.fn(() => Promise.resolve());
}

describe('SaveDialog', () => {
  async function render() {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };

    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const submit = () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      return fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, root, submit };
  }

  it('announces each time it opens', async () => {
    const { host, fixture } = await render();
    expect(host.opened).toBe(1);

    host.open.set(false);
    await fixture.whenStable();
    host.open.set(true);
    await fixture.whenStable();
    expect(host.opened).toBe(2);
  });

  it('does not save an invalid form', async () => {
    const { host, submit } = await render();

    await submit();

    expect(host.save).not.toHaveBeenCalled();
    expect(host.form.controls.name.touched).toBe(true);
    expect(host.open()).toBe(true);
  });

  it('saves a valid form and closes', async () => {
    const { host, submit } = await render();
    host.form.controls.name.setValue('algo');

    await submit();

    expect(host.save).toHaveBeenCalledTimes(1);
    expect(host.open()).toBe(false);
  });

  it('stays open and shows the error when saving fails', async () => {
    const { host, root, fixture, submit } = await render();
    host.form.controls.name.setValue('algo');
    host.save.mockRejectedValueOnce(new Error('Nombre repetido'));

    await submit();
    await fixture.whenStable();

    expect(host.open()).toBe(true);
    expect(root.textContent).toContain('Nombre repetido');
  });
});
