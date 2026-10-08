import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatHours } from '@shared/util/date';
import { HoursBucket } from '../../domain/buckets';

/**
 * Horas del período en barras, una por grupo (día, semana, mes o año según lo largo que sea el
 * período). Cada barra es relativa al grupo con más horas.
 */
@Component({
  selector: 'app-hours-by-day',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hours-by-day.html',
  styleUrl: './hours-by-day.scss',
})
export class HoursByDay {
  readonly buckets = input.required<readonly HoursBucket[]>();

  private readonly max = computed(() => Math.max(0, ...this.buckets().map((b) => b.hours)));

  protected width(hours: number): number {
    const max = this.max();
    return max === 0 ? 0 : Math.round((hours / max) * 100);
  }

  protected hoursLabel(hours: number): string {
    return hours === 0 ? '—' : formatHours(hours);
  }
}
