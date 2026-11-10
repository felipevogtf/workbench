import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Agent, agentLabel } from '@ai-agents/index';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import { AgentUsage, WindowUsage, formatPoints, formatTokens } from '../../models/usage';

interface Row {
  key: string;
  name: string;
  avatar: string | null;
  /** Quien no es un agente: lo que se gasta al subir la rama y medir el plan. */
  system: boolean;
  jobs: number;
  tokens: string;
  share: number;
  points: string | null;
  /** Tokens en cada ventana de 5 horas mostrada, en el mismo orden que las columnas. */
  perWindow: { tokens: string; points: string | null }[];
}

/** Cuántas ventanas de 5 horas se muestran: las más recientes. */
const MAX_WINDOWS = 5;

const DAY = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric' });
const HOUR = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

/**
 * Lo que gastó cada trabajador en el período: trabajos, tokens (exactos), qué parte del total del Workbench
 * es y, si hay calibración, cuánto de la semana habría costado. Los trabajos sin agente van juntos.
 */
@Component({
  selector: 'app-usage-by-agent',
  imports: [Avatar, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table>
        <caption class="visually-hidden">
          Consumo por trabajador
        </caption>
        <thead>
          <tr>
            <th scope="col">Trabajador</th>
            @if (view() === 'period') {
              <th scope="col" class="num">Trabajos</th>
              <th scope="col" class="num">Tokens</th>
              <th scope="col">Del total</th>
              <th scope="col" class="num">De la semana</th>
            } @else {
              @for (column of columns(); track column.key) {
                <th scope="col" class="num" [title]="column.title">
                  {{ column.label }}
                  @if (column.current) {
                    <span class="now">ahora</span>
                  }
                </th>
              }
            }
          </tr>
        </thead>
        <tbody>
          @for (row of table(); track row.key) {
            <tr>
              <td>
                <span class="who">
                  @if (row.system) {
                    <span class="who__system" aria-hidden="true"
                      ><app-icon name="refresh" size="1.1rem"
                    /></span>
                  } @else {
                    <app-avatar [name]="row.name" [src]="row.avatar" size="2rem" />
                  }
                  <span class="who__name break-anywhere">{{ row.name }}</span>
                </span>
              </td>
              @if (view() === 'period') {
                <td class="num">{{ row.jobs }}</td>
                <td class="num">{{ row.tokens }}</td>
                <td>
                  <span class="share">
                    <span class="share__bar" aria-hidden="true">
                      <span class="share__fill" [style.width.%]="row.share"></span>
                    </span>
                    {{ row.share }} %
                  </span>
                </td>
                <td class="num muted">{{ row.points ?? '—' }}</td>
              } @else {
                @for (cell of row.perWindow; track $index) {
                  <td class="num">
                    {{ cell.tokens }}
                    @if (cell.points) {
                      <span class="cell__points">{{ cell.points }}</span>
                    }
                  </td>
                }
              }
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
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .muted {
      color: var(--text-color);
    }

    .cell__points {
      display: block;
      font-size: 0.75rem;
      color: var(--text-color);
    }

    th .now {
      margin-left: var(--space-1);
      padding: 1px var(--space-2);
      font-size: 0.75rem;
      border-radius: 999px;
      background: var(--tone-success-bg);
      color: var(--tone-success-fg);
    }

    .who {
      display: inline-flex;
      align-items: center;
      gap: var(--space-3);
    }

    .who__name {
      font-weight: 600;
    }

    .who__system {
      display: inline-grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--tone-neutral-bg);
    }

    .share {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 9rem;
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
    }

    .share__bar {
      flex: 1;
      height: 0.5rem;
      overflow: hidden;
      border-radius: 999px;
      background: var(--tone-neutral-bg);
    }

    .share__fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--primary);
    }
  `,
})
export class UsageByAgent {
  readonly rows = input.required<readonly AgentUsage[]>();
  /** Los trabajadores de ahora, para mostrar su nombre y su imagen. */
  readonly agents = input<readonly Agent[]>([]);

  /** `period`: lo del período (trabajos, tokens y % de la semana); `windows`: lo de cada ventana de 5 horas. */
  readonly view = input<'period' | 'windows'>('period');
  /** Las ventanas de 5 horas, de la más antigua a la más nueva. */
  readonly windows = input<readonly WindowUsage[]>([]);
  /** Para saber cuál es la ventana de ahora. */
  readonly now = input<number>(Date.now());

  private readonly recent = computed(() => [...this.windows()].reverse().slice(0, MAX_WINDOWS));

  protected readonly columns = computed(() =>
    this.recent().map((window) => {
      const start = new Date(window.startsAt);
      const end = new Date(window.endsAt);
      return {
        key: window.resetsAt,
        label: `${DAY.format(start)} ${HOUR.format(start)}–${HOUR.format(end)}`,
        title: `Ventana de 5 horas: ${formatTokens(window.tokens)} tokens en total`,
        current: start.getTime() <= this.now() && this.now() < end.getTime(),
      };
    }),
  );

  protected readonly table = computed<Row[]>(() => {
    const total = this.rows().reduce((sum, row) => sum + row.tokens, 0);
    const all = this.rows().map((row) => {
      // Por su id y, si ya no existe, por el nombre técnico que quedó en el trabajo.
      const agent =
        this.agents().find((candidate) => candidate.id === row.agentId) ??
        this.agents().find((candidate) => candidate.name === row.agentName);
      return {
        key: row.agentId ?? 'system',
        name: agent
          ? agentLabel(agent)
          : row.agentId === null
            ? 'Subida y medición'
            : (row.agentName ?? 'Un trabajador que ya no está'),
        avatar: agent?.avatar ?? null,
        system: row.agentId === null,
        jobs: row.jobs,
        tokens: formatTokens(row.tokens),
        share: total > 0 ? Math.round((row.tokens / total) * 100) : 0,
        points: row.estimatedPoints === null ? null : formatPoints(row.estimatedPoints),
        perWindow: this.recent().map((window) => {
          const spent = window.byAgent[row.agentId ?? 'none'];
          return {
            tokens: spent && spent.tokens > 0 ? formatTokens(spent.tokens) : '—',
            points:
              spent && spent.estimatedPoints !== null ? formatPoints(spent.estimatedPoints) : null,
          };
        }),
      };
    });
    // Por ventana solo van los que gastaron en alguna de las mostradas.
    return this.view() === 'period'
      ? all
      : all.filter((row) => row.perWindow.some((cell) => cell.tokens !== '—'));
  });
}
