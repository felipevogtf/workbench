import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WindowUsage, formatFraction, formatTokens } from '../../models/usage';

/** Cuántas ventanas se muestran: las más recientes. */
const MAX_WINDOWS = 10;

interface Row {
  key: string;
  label: string;
  current: boolean;
  /** 0 a 100, para la barra. */
  percent: number;
  peak: string;
  /** Pocas medidas: el pico real puede haber sido mayor. */
  partial: boolean;
  tokens: string;
}

const DAY = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
const HOUR = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

/**
 * Las ventanas de 5 horas de los últimos días: cuánto se llegó a usar de toda la cuenta en cada una (según las
 * medidas que hay) y cuánto gastó el Workbench dentro. Sirve para ver cómo se reparte el día entre ventanas.
 */
@Component({
  selector: 'app-usage-windows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table>
        <caption class="visually-hidden">
          Consumo por ventana de 5 horas
        </caption>
        <thead>
          <tr>
            <th scope="col">Ventana</th>
            <th scope="col">Uso de tu cuenta</th>
            <th scope="col" class="num">Workbench</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.key) {
            <tr [class.is-current]="row.current">
              <td>
                {{ row.label }}
                @if (row.current) {
                  <span class="now">ahora</span>
                }
              </td>
              <td>
                <span class="peak">
                  <span class="peak__bar" aria-hidden="true">
                    <span class="peak__fill" [style.width.%]="row.percent"></span>
                  </span>
                  {{ row.partial ? 'al menos ' : '' }}{{ row.peak }}
                </span>
              </td>
              <td class="num">{{ row.tokens }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--border-radius);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      padding: var(--space-3) var(--space-4);
      text-align: left;
      font-weight: 500;
      font-size: 0.875rem;
      color: var(--text-color);
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    td {
      padding: var(--space-3) var(--space-4);
      vertical-align: middle;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .is-current td {
      font-weight: 600;
    }

    .now {
      margin-left: var(--space-2);
      padding: 1px var(--space-2);
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 999px;
      background: var(--tone-success-bg);
      color: var(--tone-success-fg);
    }

    .peak {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 11rem;
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
    }

    .peak__bar {
      flex: 1;
      height: 0.5rem;
      min-width: 4rem;
      overflow: hidden;
      border-radius: 999px;
      background: var(--tone-neutral-bg);
    }

    .peak__fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--primary);
    }
  `,
})
export class UsageWindows {
  readonly windows = input.required<readonly WindowUsage[]>();
  /** Para saber cuál es la ventana de ahora. */
  readonly now = input<number>(Date.now());

  protected readonly rows = computed<Row[]>(() =>
    [...this.windows()]
      .reverse()
      .slice(0, MAX_WINDOWS)
      .map((window) => {
        const start = new Date(window.startsAt);
        const end = new Date(window.resetsAt);
        return {
          key: window.resetsAt,
          label: `${DAY.format(start)} · ${HOUR.format(start)} – ${HOUR.format(end)}`,
          current: start.getTime() <= this.now() && this.now() < end.getTime(),
          percent: Math.min(100, Math.round(window.peak * 100)),
          peak: formatFraction(window.peak),
          partial: window.measures < 2,
          tokens: `${formatTokens(window.tokens)} tokens`,
        };
      }),
  );
}
