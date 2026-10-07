import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '@core/api/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { TextInput } from '@shared/ui/text-input/text-input';
import { formatDay, formatHours, todayIso } from '@shared/util/date';
import { TimeEntriesStore } from '../../data-access/time-entries.store';

/**
 * Horas registradas de una tarea: formulario para agregar (varias por día), lista por día y total.
 * Usa el `TimeEntriesStore` que provee la página que lo contiene.
 */
@Component({
  selector: 'app-hours-panel',
  imports: [ReactiveFormsModule, Card, FormField, TextInput, Button, Icon, IconButton, Alert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hours-panel.html',
  styleUrl: './hours-panel.scss',
})
export class HoursPanel {
  /** Horas estimadas de la tarea, para mostrar el total «de X estimadas». */
  readonly estimatedHours = input<number | null>(null);

  protected readonly hours = inject(TimeEntriesStore);
  protected readonly formatDay = formatDay;
  protected readonly formatHours = formatHours;

  protected readonly form = inject(NonNullableFormBuilder).group({
    date: [todayIso(), Validators.required],
    hours: ['', [Validators.required, Validators.min(0.25), Validators.max(24)]],
  });
  protected readonly adding = signal(false);
  protected readonly addError = signal<string | null>(null);

  protected invalid(name: 'date' | 'hours'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected async add(): Promise<void> {
    this.addError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { date, hours } = this.form.getRawValue();
    this.adding.set(true);
    try {
      await this.hours.add(Number(hours), date);
      this.form.patchValue({ hours: '' });
      this.form.controls.hours.markAsUntouched();
    } catch (error) {
      this.addError.set(errorMessage(error));
    } finally {
      this.adding.set(false);
    }
  }

  protected remove(id: string): void {
    void this.hours.remove(id);
  }
}
