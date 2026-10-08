import { DomainError } from '@core/domain/domain.error';
import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Máximo de días que abarca un reporte (diez años). */
export const MAX_REPORT_DAYS = 3660;

export interface DayHours {
  date: string;
  hours: number;
}

export interface IssueHours {
  issueId: string;
  hours: number;
}

/** Horas registradas entre dos fechas (ambas incluidas), por día y por tarea. */
export interface TimeReport {
  from: string;
  to: string;
  totalHours: number;
  /** Solo los días que tienen horas, del más antiguo al más reciente. */
  byDay: DayHours[];
  /** Las tareas con horas, de la que más tiene a la que menos. */
  byIssue: IssueHours[];
}

/** Convierte `YYYY-MM-DD` en milisegundos UTC, o lanza si no es una fecha real. */
function toUtc(date: string, field: string): number {
  const time = DATE_FORMAT.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  const valid =
    !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === date;
  if (!valid) {
    throw new DomainError(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  return time;
}

/** Valida el rango de un reporte: fechas reales, `from <= to` y no más de un año. */
export function validateReportRange(from: string, to: string): void {
  const start = toUtc(from, 'from');
  const end = toUtc(to, 'to');

  if (start > end) {
    throw new DomainError('from must not be after to');
  }
  if ((end - start) / DAY_MS + 1 > MAX_REPORT_DAYS) {
    throw new DomainError(`The range cannot exceed ${MAX_REPORT_DAYS} days`);
  }
}

/** Evita arrastrar errores de coma flotante al sumar horas decimales. */
const round = (hours: number) => Math.round(hours * 100) / 100;

/** Agrupa las entradas de horas de un rango por día y por tarea. */
export function buildTimeReport(
  from: string,
  to: string,
  entries: readonly TimeEntry[],
): TimeReport {
  const days = new Map<string, number>();
  const issues = new Map<string, number>();

  for (const entry of entries) {
    days.set(entry.date, (days.get(entry.date) ?? 0) + entry.hours);
    issues.set(entry.issueId, (issues.get(entry.issueId) ?? 0) + entry.hours);
  }

  return {
    from,
    to,
    totalHours: round(entries.reduce((sum, entry) => sum + entry.hours, 0)),
    byDay: [...days.entries()]
      .map(([date, hours]) => ({ date, hours: round(hours) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byIssue: [...issues.entries()]
      .map(([issueId, hours]) => ({ issueId, hours: round(hours) }))
      .sort((a, b) => b.hours - a.hours || a.issueId.localeCompare(b.issueId)),
  };
}
