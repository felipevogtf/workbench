import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UsageWindow, formatFraction, resetText, untilText } from '../../models/usage';

/**
 * Una ventana del plan como una barra: cuánto se lleva usado, cuánto queda y cuándo se reinicia. Es el
 * dato de la cuenta entera, no solo del Workbench.
 */
@Component({
  selector: 'app-usage-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="meter" [attr.data-level]="level()" [attr.aria-label]="title()">
      <h3 class="meter__title">{{ title() }}</h3>

      @if (window(); as w) {
        <p class="meter__value">
          <strong>{{ used() }}</strong> usado
          <span class="meter__left">· te queda {{ left() }}</span>
        </p>
        <div
          class="meter__bar"
          role="progressbar"
          [attr.aria-label]="title()"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="percent()"
        >
          <div class="meter__fill" [style.width.%]="percent()"></div>
        </div>
        <p class="meter__reset">
          Se reinicia el {{ reset(w) }} <span class="meter__until">({{ until(w) }})</span>
        </p>
      } @else {
        <p class="meter__none">Sin datos todavía.</p>
      }
    </section>
  `,
  styles: `
    .meter {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--border-radius);
    }

    .meter__title {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 600;
    }

    .meter__value {
      margin: 0;
      font-size: 1rem;
    }

    .meter__value strong {
      font-size: 1.75rem;
    }

    .meter__left,
    .meter__until,
    .meter__none {
      color: var(--text-color);
    }

    .meter__bar {
      height: 0.75rem;
      overflow: hidden;
      border-radius: 999px;
      background: var(--tone-neutral-bg);
    }

    .meter__fill {
      height: 100%;
      border-radius: inherit;
      background: var(--success);
      transition: width 0.3s ease;
    }

    .meter[data-level='warning'] .meter__fill {
      background: var(--warning);
    }

    .meter[data-level='danger'] .meter__fill {
      background: var(--danger);
    }

    .meter__reset {
      margin: 0;
      font-size: 0.875rem;
    }
  `,
})
export class UsageMeter {
  readonly title = input.required<string>();
  readonly window = input<UsageWindow | null>(null);
  /** El momento con que se cuenta cuánto falta para el reinicio. */
  readonly now = input(Date.now());

  protected readonly percent = computed(() =>
    Math.max(0, Math.min(100, Math.round((this.window()?.used ?? 0) * 100))),
  );
  protected readonly used = computed(() => formatFraction(this.window()?.used ?? 0));
  protected readonly left = computed(() => `${100 - this.percent()} %`);
  /** Cambia de color al acercarse al tope. */
  protected readonly level = computed(() =>
    this.percent() >= 90 ? 'danger' : this.percent() >= 70 ? 'warning' : 'ok',
  );

  protected reset(window: UsageWindow): string {
    return resetText(window.resetsAt);
  }

  protected until(window: UsageWindow): string {
    return untilText(window.resetsAt, this.now());
  }
}
