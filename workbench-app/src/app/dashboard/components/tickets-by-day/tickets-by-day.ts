import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatHours } from '@shared/util/date';
import { WorkedDay } from '../../domain/group-by-day';

const DAY = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });

/** En qué tickets se trabajó cada día de la semana, con las horas de cada uno. */
@Component({
  selector: 'app-tickets-by-day',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="days">
      @for (day of days(); track day.date) {
        <!-- Cerrados por defecto: sin \`open\`. -->
        <details class="day">
          <summary class="day__head">
            <span class="day__name">{{ label(day.date) }}</span>
            <span class="day__count">
              {{ day.issues.length }} {{ day.issues.length === 1 ? 'ticket' : 'tickets' }}
            </span>
            <span class="day__total">{{ formatHours(day.totalHours) }}</span>
          </summary>
          <ul class="issues">
            @for (issue of day.issues; track issue.id) {
              <li class="issue">
                <span class="issue__code">{{ issue.code }}</span>
                <a class="issue__name break-anywhere" [routerLink]="['/tasks/issues', issue.id]">{{
                  issue.name
                }}</a>
                <span class="issue__hours">{{ formatHours(issue.hours) }}</span>
              </li>
            }
          </ul>
        </details>
      }
    </div>
  `,
  styles: `
    .days {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .day {
      padding: 0 var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--border-radius);
      background: var(--background);
    }

    .day__head {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      padding: var(--space-3) 0;
      cursor: pointer;
    }

    .day[open] > .day__head {
      border-bottom: 1px solid var(--border);
    }

    .day__name {
      flex: 1;
      font-weight: 600;
      color: var(--primary);
      text-transform: capitalize;
    }

    .day__count {
      font-size: 0.8125rem;
      color: var(--text-color);
      white-space: nowrap;
    }

    .day__total {
      flex: none;
      font-weight: 700;
      color: var(--primary);
      white-space: nowrap;
    }

    .issues {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .issue {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: baseline;
      gap: var(--space-3);
      padding: var(--space-3) 0;
    }

    .issue + .issue {
      border-top: 1px solid var(--border);
    }

    .issue__code {
      font-size: 0.8125rem;
      color: var(--text-color);
      white-space: nowrap;
    }

    .issue__name {
      color: var(--primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }

    .issue__hours {
      font-weight: 600;
      color: var(--primary);
      white-space: nowrap;
    }
  `,
})
export class TicketsByDay {
  readonly days = input.required<readonly WorkedDay[]>();

  protected readonly formatHours = formatHours;

  protected label(date: string): string {
    return DAY.format(new Date(`${date}T12:00:00`)).replace(/\./g, '');
  }
}
