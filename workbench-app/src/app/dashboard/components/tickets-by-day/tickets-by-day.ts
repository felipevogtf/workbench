import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from '@shared/ui/card/card';
import { formatHours } from '@shared/util/date';
import { WorkedDay } from '../../domain/group-by-day';

const DAY = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });

/** En qué tickets se trabajó cada día de la semana, con las horas de cada uno. */
@Component({
  selector: 'app-tickets-by-day',
  imports: [RouterLink, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="days">
      @for (day of days(); track day.date) {
        <app-card>
          <div card-header class="day__head">
            <h4 class="day__name">{{ label(day.date) }}</h4>
            <span class="day__total">{{ formatHours(day.totalHours) }}</span>
          </div>
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
        </app-card>
      }
    </div>
  `,
  styles: `
    .days {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .day__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .day__name {
      margin: 0;
      font-weight: 600;
      color: var(--primary);
      text-transform: capitalize;
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
