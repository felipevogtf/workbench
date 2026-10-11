import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Toast } from '@shared/ui/toast/toast';
import { copyText } from '@shared/util/copy-text';
import { errorMessage } from '@shared/util/error-message';
import {
  CHARACTER_SETS,
  DEFAULT_OPTIONS,
  MAX_LENGTH,
  MIN_LENGTH,
  PasswordOptions,
  StrengthLevel,
  generatePassword,
  strengthOf,
} from '../../domain/password-generator';

const STRENGTH_LABEL: Record<StrengthLevel, string> = {
  weak: 'Débil',
  fair: 'Aceptable',
  strong: 'Segura',
  'very-strong': 'Muy segura',
};

/** Generador de contraseñas: se ajusta la longitud y los tipos de carácter, y se copia el resultado. */
@Component({
  selector: 'app-password-generator',
  imports: [ReactiveFormsModule, Button, Checkbox, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './password-generator.html',
  styleUrl: './password-generator.scss',
})
export class PasswordGenerator {
  private readonly toast = inject(Toast);

  protected readonly minLength = MIN_LENGTH;
  protected readonly maxLength = MAX_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    length: [DEFAULT_OPTIONS.length],
    uppercase: [DEFAULT_OPTIONS.uppercase],
    lowercase: [DEFAULT_OPTIONS.lowercase],
    digits: [DEFAULT_OPTIONS.digits],
    symbols: [DEFAULT_OPTIONS.symbols],
    avoidAmbiguous: [DEFAULT_OPTIONS.avoidAmbiguous],
  });

  private readonly options = toSignal(
    this.form.valueChanges.pipe(map((): PasswordOptions => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  /** Cambia en cada «regenerar» para pedir otra contraseña con las mismas opciones. */
  private readonly attempt = signal(0);

  protected readonly password = computed(() => {
    this.attempt();
    return generatePassword(this.options());
  });
  protected readonly strength = computed(() => strengthOf(this.options()));
  protected readonly bits = computed(() => Math.min(100, Math.round(this.strength().bits)));
  protected readonly strengthLabel = computed(() => STRENGTH_LABEL[this.strength().level]);

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.lockLastSet());
  }

  protected regenerate(): void {
    this.attempt.update((n) => n + 1);
  }

  protected async copy(): Promise<void> {
    try {
      await copyText(this.password());
      this.toast.success('Contraseña copiada al portapapeles');
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  /** Siempre debe quedar un tipo de carácter activo: el último no se puede desmarcar. */
  private lockLastSet(): void {
    const active = CHARACTER_SETS.filter((set) => this.form.controls[set].value);
    for (const set of CHARACTER_SETS) {
      const control = this.form.controls[set];
      const isLast = active.length === 1 && active[0] === set;
      if (isLast && control.enabled) control.disable({ emitEvent: false });
      else if (!isLast && control.disabled) control.enable({ emitEvent: false });
    }
  }
}
