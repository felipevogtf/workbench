import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField } from '@shared/ui/form-field/form-field';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { TextInput } from '@shared/ui/text-input/text-input';

/** Crea o renombra un proyecto local. */
@Component({
  selector: 'app-project-name-dialog',
  imports: [ReactiveFormsModule, SaveDialog, FormField, TextInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-save-dialog
      [(open)]="open"
      [heading]="heading()"
      [form]="form"
      [save]="submit"
      (opened)="reset()"
    >
      <div class="stack" [formGroup]="form">
        <app-form-field
          label="Nombre"
          for="project-name"
          required
          [error]="nameInvalid() ? 'Escribe un nombre' : null"
        >
          <app-text-input
            inputId="project-name"
            formControlName="name"
            [invalid]="nameInvalid()"
            [describedBy]="'project-name-msg'"
          />
        </app-form-field>
      </div>
    </app-save-dialog>
  `,
})
export class ProjectNameDialog {
  readonly open = model(false);
  readonly heading = input.required<string>();
  /** Nombre actual al renombrar; `null` al crear. */
  readonly initial = input<{ name: string } | null>(null);
  readonly save = input.required<(name: string) => Promise<unknown>>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  protected readonly submit = (): Promise<unknown> =>
    this.save()(this.form.getRawValue().name.trim());

  protected reset(): void {
    this.form.reset({ name: this.initial()?.name ?? '' });
  }

  protected nameInvalid(): boolean {
    const control = this.form.controls.name;
    return control.touched && control.invalid;
  }
}
