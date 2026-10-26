import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Agent, agentLabel } from '@ai-agents/index';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import { AgentUsage, formatPoints, formatTokens } from '../../models/usage';

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
}

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
            <th scope="col" class="num">Trabajos</th>
            <th scope="col" class="num">Tokens</th>
            <th scope="col">Del total</th>
            <th scope="col" class="num">De la semana</th>
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

  protected readonly table = computed<Row[]>(() => {
    const total = this.rows().reduce((sum, row) => sum + row.tokens, 0);
    return this.rows().map((row) => {
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
      };
    });
  });
}
