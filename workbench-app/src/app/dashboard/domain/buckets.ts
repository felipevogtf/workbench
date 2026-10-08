import { DateRange, eachDay, parseIso, weekRange } from './period';
import { DayHours } from '../models/time-report';

/** En qué se agrupan las horas del gráfico según lo largo que sea el período. */
export type BucketUnit = 'day' | 'week' | 'month' | 'year';

export interface HoursBucket {
  /** Identifica el grupo (`2026-10-05`, `2026-10`, `2026`). */
  key: string;
  label: string;
  hours: number;
}

export interface BucketedHours {
  unit: BucketUnit;
  buckets: HoursBucket[];
}

/** Hasta una semana se ve por día. */
const MAX_DAYS_BY_DAY = 7;
/** Hasta cuatro semanas, y también un mes calendario (31 días), por semana. */
const MAX_DAYS_BY_WEEK = 31;
/** Hasta doce meses, por mes; más que eso, por año. */
const MAX_DAYS_BY_MONTH = 366;

/**
 * Por día hasta una semana, por semana hasta cuatro semanas (o un mes), por mes hasta doce meses y
 * por año si es más. Así el gráfico nunca tiene más de unas pocas decenas de barras.
 */
export function bucketUnit(range: DateRange): BucketUnit {
  const days = eachDay(range).length;
  if (days <= MAX_DAYS_BY_DAY) return 'day';
  if (days <= MAX_DAYS_BY_WEEK) return 'week';
  if (days <= MAX_DAYS_BY_MONTH) return 'month';
  return 'year';
}

const SHORT_MONTH: Intl.DateTimeFormatOptions = { month: 'short' };

function dayLabel(date: string): string {
  return parseIso(date)
    .toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(',', '')
    .replace(/\./g, '');
}

/** `5 – 11 oct`, o `28 sep – 4 oct` si la semana cruza de mes. */
function weekLabel(from: string, to: string): string {
  const start = parseIso(from);
  const end = parseIso(to);
  if (from === to) return dayLabel(from);

  const month = (date: Date) => date.toLocaleDateString('es-CL', SHORT_MONTH).replace(/\./g, '');
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${start.getDate()} – ${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
}

function monthLabel(date: string): string {
  return parseIso(date)
    .toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })
    .replace(/\./g, '');
}

/** Evita arrastrar errores de coma flotante al sumar horas decimales. */
const round = (hours: number) => Math.round(hours * 100) / 100;

/**
 * Agrupa las horas de cada día del rango según su largo (ver `bucketUnit`). Salen todos los grupos
 * del rango, también los que no tienen horas; los de los extremos solo cuentan los días del rango.
 */
export function bucketHours(range: DateRange, byDay: readonly DayHours[]): BucketedHours {
  const unit = bucketUnit(range);
  const hoursByDay = new Map(byDay.map((day) => [day.date, day.hours]));
  const groups = new Map<string, { from: string; to: string; hours: number }>();

  for (const date of eachDay(range)) {
    const key =
      unit === 'day'
        ? date
        : unit === 'week'
          ? weekRange(date).from
          : unit === 'month'
            ? date.slice(0, 7)
            : date.slice(0, 4);

    const group = groups.get(key) ?? { from: date, to: date, hours: 0 };
    group.to = date;
    group.hours += hoursByDay.get(date) ?? 0;
    groups.set(key, group);
  }

  const buckets = [...groups.entries()].map(([key, group]): HoursBucket => {
    const label =
      unit === 'day'
        ? dayLabel(group.from)
        : unit === 'week'
          ? weekLabel(group.from, group.to)
          : unit === 'month'
            ? monthLabel(group.from)
            : key;
    return { key, label, hours: round(group.hours) };
  });

  return { unit, buckets };
}

/** Título del gráfico según la unidad: «Horas por semana». */
export function bucketTitle(unit: BucketUnit): string {
  const name = { day: 'día', week: 'semana', month: 'mes', year: 'año' }[unit];
  return `Horas por ${name}`;
}
