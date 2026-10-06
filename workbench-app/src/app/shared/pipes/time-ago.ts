import { Pipe, PipeTransform } from '@angular/core';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "hace 5 min", "hace 2 h"… Para fechas de más de una semana muestra la fecha. */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return 'hace unos segundos';
  if (seconds < HOUR) return `hace ${Math.max(1, Math.round(seconds / MINUTE))} min`;
  if (seconds < DAY) return `hace ${Math.round(seconds / HOUR)} h`;
  if (seconds < 7 * DAY) return `hace ${Math.round(seconds / DAY)} d`;
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return timeAgo(value);
  }
}
