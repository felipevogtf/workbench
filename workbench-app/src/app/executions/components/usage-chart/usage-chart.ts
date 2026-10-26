import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DayUsage, formatPoints, formatTokens } from '../../models/usage';

export type ChartUnit = 'tokens' | 'points';

/** Las etapas, de abajo hacia arriba, con cómo se llaman en el gráfico. */
const KINDS: readonly { kind: string; label: string }[] = [
  { kind: 'tickets', label: 'Tickets' },
  { kind: 'develop', label: 'Desarrollo' },
  { kind: 'review', label: 'Revisión' },
  { kind: 'publish', label: 'Subida y medición' },
];

/**
 * Lo que gastó el Workbench cada día, en barras: en tokens (apiladas por etapa) o, si hay con qué
 * calibrar, en puntos estimados de la semana. Hecho a mano con CSS: no necesita ninguna librería.
 */
@Component({
  selector: 'app-usage-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <div class="chart__plot" role="img" [attr.aria-label]="summary()">
        <span class="chart__max">{{ maxLabel() }}</span>
        @if (empty()) {
          <p class="chart__none">
            Todavía no hay gasto medido: las ejecuciones anteriores no guardaban los tokens. Se
            empieza a contar desde la próxima.
          </p>
        }
        @for (bar of bars(); track bar.date) {
          <div class="chart__col" [title]="bar.tooltip">
            <div class="chart__bar" [style.height.%]="bar.height">
              @for (part of bar.parts; track part.kind) {
                <span
                  class="chart__part"
                  [attr.data-kind]="part.kind"
                  [style.flex-grow]="part.share"
                ></span>
              }
            </div>
            <span class="chart__label">{{ bar.label }}</span>
          </div>
        }
      </div>

      @if (unit() === 'tokens') {
        <figcaption class="chart__legend">
          @for (item of legend; track item.kind) {
            <span class="chart__key"
              ><i class="chart__swatch" [attr.data-kind]="item.kind"></i>{{ item.label }}</span
            >
          }
        </figcaption>
      }

      <table class="visually-hidden">
        <caption>
          Consumo por día
        </caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Tokens</th>
            <th scope="col">Puntos estimados de la semana</th>
          </tr>
        </thead>
        <tbody>
          @for (day of days(); track day.date) {
            <tr>
              <td>{{ day.date }}</td>
              <td>{{ tokens(day.tokens) }}</td>
              <td>{{ day.estimatedPoints === null ? '—' : points(day.estimatedPoints) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </figure>
  `,
  styles: `
    .chart {
      margin: 0;
    }

    .chart__plot {
      position: relative;
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 180px;
      padding-top: var(--space-4);
      border-bottom: 1px solid var(--border);
    }

    .chart__max {
      position: absolute;
      top: 0;
      left: 0;
      font-size: 0.75rem;
      color: var(--text-color);
    }

    .chart__none {
      position: absolute;
      inset: 2rem 0 auto 0;
      margin: 0;
      text-align: center;
      font-size: 0.875rem;
      color: var(--text-color);
    }

    .chart__col {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      height: 100%;
      min-width: 0;
    }

    .chart__bar {
      display: flex;
      flex-direction: column-reverse;
      width: 100%;
      max-width: 36px;
      min-height: 0;
      overflow: hidden;
      border-radius: 4px 4px 0 0;
      background: var(--primary);
    }

    .chart__part {
      flex-basis: 0;
      min-height: 2px;
    }

    .chart__part[data-kind='tickets'],
    .chart__swatch[data-kind='tickets'] {
      background: #3b82f6;
    }

    .chart__part[data-kind='develop'],
    .chart__swatch[data-kind='develop'] {
      background: var(--primary);
    }

    .chart__part[data-kind='review'],
    .chart__swatch[data-kind='review'] {
      background: var(--warning);
    }

    .chart__part[data-kind='publish'],
    .chart__swatch[data-kind='publish'] {
      background: var(--text-color);
    }

    .chart__label {
      position: absolute;
      bottom: -1.5rem;
      font-size: 0.6875rem;
      color: var(--text-color);
    }

    .chart__col {
      position: relative;
    }

    .chart__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      margin-top: 2rem;
      font-size: 0.8125rem;
    }

    .chart__key {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .chart__swatch {
      display: inline-block;
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 2px;
    }
  `,
})
export class UsageChart {
  readonly days = input.required<readonly DayUsage[]>();
  readonly unit = input<ChartUnit>('tokens');

  protected readonly legend = KINDS;
  protected readonly tokens = formatTokens;
  protected readonly points = formatPoints;

  /** El valor de un día en la unidad del gráfico. */
  private value(day: DayUsage): number {
    return this.unit() === 'points' ? (day.estimatedPoints ?? 0) : day.tokens;
  }

  private readonly max = computed(() => Math.max(0, ...this.days().map((day) => this.value(day))));

  /** Ningún día tiene gasto medido. */
  protected readonly empty = computed(() => this.days().every((day) => day.tokens === 0));

  protected readonly maxLabel = computed(() =>
    this.unit() === 'points' ? formatPoints(this.max()) : `${formatTokens(this.max())} tokens`,
  );

  protected readonly bars = computed(() =>
    this.days().map((day) => {
      const total = Object.values(day.byKind).reduce((sum, tokens) => sum + tokens, 0);
      const parts =
        this.unit() === 'tokens'
          ? KINDS.filter((item) => (day.byKind[item.kind] ?? 0) > 0).map((item) => ({
              kind: item.kind,
              share: (day.byKind[item.kind] ?? 0) / (total || 1),
            }))
          : [{ kind: 'develop', share: 1 }];
      const [, month, dayOfMonth] = day.date.split('-');
      return {
        date: day.date,
        label: `${dayOfMonth}/${month}`,
        height: this.max() > 0 ? (this.value(day) / this.max()) * 100 : 0,
        parts,
        tooltip:
          `${day.date}: ${formatTokens(day.tokens)} tokens` +
          (day.estimatedPoints === null
            ? ''
            : ` (${formatPoints(day.estimatedPoints)} de la semana)`),
      };
    }),
  );

  protected readonly summary = computed(() => {
    const total = this.days().reduce((sum, day) => sum + day.tokens, 0);
    return `Consumo de los últimos ${this.days().length} días: ${formatTokens(total)} tokens en total.`;
  });
}
