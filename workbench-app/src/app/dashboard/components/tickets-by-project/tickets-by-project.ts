import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from '@shared/ui/card/card';
import { formatHours } from '@shared/util/date';
import { WorkedProject } from '../../domain/group-by-project';

/** Las tareas con horas del período, agrupadas por proyecto y con la suma de horas de cada uno. */
@Component({
  selector: 'app-tickets-by-project',
  imports: [RouterLink, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets-by-project.html',
  styleUrl: './tickets-by-project.scss',
})
export class TicketsByProject {
  readonly projects = input.required<readonly WorkedProject[]>();

  protected readonly formatHours = formatHours;
}
