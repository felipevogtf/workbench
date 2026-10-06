import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Etiqueta + control + ayuda/error. `for` debe coincidir con el `inputId` del control proyectado;
 * el error se enlaza al control con `aria-describedby="<for>-msg"`.
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label [attr.for]="for()">
      {{ label() }}
      @if (required()) {
        <span aria-hidden="true">*</span>
      }
    </label>
    <ng-content />
    @if (error()) {
      <p class="msg msg--error" role="alert" [id]="for() + '-msg'">{{ error() }}</p>
    } @else if (hint()) {
      <p class="msg" [id]="for() + '-msg'">{{ hint() }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 0;
    }

    label {
      font-weight: 500;
    }

    .msg {
      margin: 0;
      font-size: 0.875rem;
    }

    .msg--error {
      color: var(--tone-danger-fg);
    }
  `,
})
export class FormField {
  readonly label = input.required<string>();
  readonly for = input.required<string>();
  readonly hint = input<string>();
  readonly error = input<string | null>(null);
  readonly required = input(false, { transform: booleanAttribute });
}
