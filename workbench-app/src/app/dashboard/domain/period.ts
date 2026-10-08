import { formatDay } from '@shared/util/date';

/** Cómo se elige el período: la semana (lunes a domingo), el mes, o un rango libre. */
export type PeriodMode = 'week' | 'month' | 'range';

/** Rango de fechas `YYYY-MM-DD`, ambas incluidas. */
export interface DateRange {
  from: string;
  to: string;
}

/** Lo mismo que acepta el servidor: un rango no puede abarcar más de 10 años. */
export const MAX_RANGE_DAYS = 3660;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local → `YYYY-MM-DD` (`toISOString` daría el día en UTC). */
export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` → medianoche local de ese día. */
export function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Lunes a domingo de la semana que contiene la fecha. */
export function weekRange(iso: string): DateRange {
  const sinceMonday = (parseIso(iso).getDay() + 6) % 7;
  const from = addDays(iso, -sinceMonday);
  return { from, to: addDays(from, 6) };
}

/** Del día 1 al último día del mes que contiene la fecha. */
export function monthRange(iso: string): DateRange {
  const date = parseIso(iso);
  return {
    from: toIso(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: toIso(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

/** Rango que corresponde a una fecha de referencia según el modo (en `range` no aplica). */
export function periodRange(mode: Exclude<PeriodMode, 'range'>, anchor: string): DateRange {
  return mode === 'week' ? weekRange(anchor) : monthRange(anchor);
}

/** Mueve la fecha de referencia a la semana o al mes anterior (`-1`) o siguiente (`1`). */
export function shiftAnchor(
  mode: Exclude<PeriodMode, 'range'>,
  anchor: string,
  direction: 1 | -1,
): string {
  if (mode === 'week') return addDays(anchor, 7 * direction);
  const date = parseIso(anchor);
  // Se va al día 1: sumar un mes a un 31 saltaría de mes.
  return toIso(new Date(date.getFullYear(), date.getMonth() + direction, 1));
}

/** Todos los días del rango, en orden. */
export function eachDay({ from, to }: DateRange): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** `true` si ambas fechas son reales, `from <= to` y el rango cabe en el máximo. */
export function isValidRange({ from, to }: DateRange): boolean {
  if (!DATE.test(from) || !DATE.test(to)) return false;
  if (toIso(parseIso(from)) !== from || toIso(parseIso(to)) !== to) return false;
  if (from > to) return false;
  return eachDayCount({ from, to }) <= MAX_RANGE_DAYS;
}

function eachDayCount({ from, to }: DateRange): number {
  const ms = parseIso(to).getTime() - parseIso(from).getTime();
  // Se redondea: en los cambios de hora un día mide 23 o 25 horas.
  return Math.round(ms / 86_400_000) + 1;
}

/** Texto del período para mostrarlo: `5 – 11 oct 2026`, `Octubre de 2026`, `5 oct 2026 – 12 oct 2026`. */
export function periodLabel(mode: PeriodMode, range: DateRange): string {
  if (mode === 'month') {
    const label = parseIso(range.from).toLocaleDateString('es-CL', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (mode === 'week') {
    const from = parseIso(range.from);
    const to = parseIso(range.to);
    const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
    const start = from.toLocaleDateString('es-CL', {
      day: 'numeric',
      ...(sameMonth ? {} : { month: 'short' }),
    });
    return `${start} – ${formatDay(range.to)}`;
  }
  return `${formatDay(range.from)} – ${formatDay(range.to)}`;
}
