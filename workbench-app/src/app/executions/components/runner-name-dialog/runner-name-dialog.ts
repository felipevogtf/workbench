import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField } from '@shared/ui/form-field/form-field';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { TextInput } from '@shared/ui/text-input/text-input';

/** Pide el nombre del runner nuevo (el del PC donde va a correr). */
@Component({
  selector: 'app-runner-name-dialog',
  imports: [ReactiveFormsModule, SaveDialog, FormField, TextInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-save-dialog
      [(open)]="open"
      heading="Nuevo runner"
      [form]="form"
      [save]="submit"
      (opened)="reset()"
    >
      <div class="stack" [formGroup]="form">
        <app-form-field
          label="Nombre"
          for="runner-name"
          required
          hint="El PC donde va a correr, por ejemplo «Mi PC»."
          [error]="nameInvalid() ? 'Escribe un nombre' : null"
        >
          <app-text-input
            inputId="runner-name"
            formControlName="name"
            [invalid]="nameInvalid()"
            [describedBy]="'runner-name-msg'"
          />
        </app-form-field>
      </div>
    </app-save-dialog>
  `,
})
export class RunnerNameDialog {
  readonly open = model(false);
  readonly save = input.required<(name: string) => Promise<unknown>>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
  });

  protected readonly submit = (): Promise<unknown> =>
    this.save()(this.form.getRawValue().name.trim());

  protected reset(): void {
    this.form.reset({ name: '' });
  }

  protected nameInvalid(): boolean {
    const control = this.form.controls.name;
    return control.touched && control.invalid;
  }
}
