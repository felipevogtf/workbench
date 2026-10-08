import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatHours } from '@shared/util/date';
import { DayBar } from '../../data-access/dashboard.store';
import { parseIso } from '../../domain/period';

/** Horas de cada día del período: una barra por día, relativa al día con más horas. */
@Component({
  selector: 'app-hours-by-day',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hours-by-day.html',
  styleUrl: './hours-by-day.scss',
})
export class HoursByDay {
  readonly days = input.required<readonly DayBar[]>();

  private readonly max = computed(() => Math.max(0, ...this.days().map((day) => day.hours)));

  protected width(hours: number): number {
    const max = this.max();
    return max === 0 ? 0 : Math.round((hours / max) * 100);
  }

  /** `lun 5 oct`. */
  protected label(date: string): string {
    return parseIso(date)
      .toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace(',', '')
      .replace(/\./g, '');
  }

  protected isWeekend(date: string): boolean {
    const day = parseIso(date).getDay();
    return day === 0 || day === 6;
  }

  protected hoursLabel(hours: number): string {
    return hours === 0 ? '—' : formatHours(hours);
  }
}
