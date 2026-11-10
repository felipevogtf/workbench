import { Issue, issueCode } from '@tasks/index';
import { DayIssueHours } from '../models/time-report';
import { ProjectRef } from './group-by-project';

export interface DayIssue {
  id: string;
  name: string;
  /** `MEL-123`, o `#12` si el proyecto no tiene identificador. */
  code: string;
  hours: number;
}

export interface WorkedDay {
  /** `2026-10-05`. */
  date: string;
  totalHours: number;
  issues: DayIssue[];
}

/** Evita arrastrar errores de coma flotante al sumar horas decimales. */
const round = (hours: number) => Math.round(hours * 100) / 100;

/**
 * En qué tickets se trabajó cada día: del día más antiguo al más reciente y, dentro de cada día, del
 * ticket con más horas al que menos. Solo salen los días con horas.
 */
export function groupByDay(
  byDayIssue: readonly DayIssueHours[],
  issues: ReadonlyMap<string, Issue>,
  projects: ReadonlyMap<string, ProjectRef>,
): WorkedDay[] {
  const days = new Map<string, WorkedDay>();

  for (const { date, issueId, hours } of byDayIssue) {
    const issue = issues.get(issueId);
    const project = issue ? projects.get(issue.projectId) : undefined;

    let day = days.get(date);
    if (!day) {
      day = { date, totalHours: 0, issues: [] };
      days.set(date, day);
    }
    day.totalHours += hours;
    day.issues.push({
      id: issueId,
      name: issue?.name ?? 'Tarea no disponible',
      code: issue ? issueCode(issue, project?.identifier) : '—',
      hours,
    });
  }

  return [...days.values()]
    .map((day) => ({
      ...day,
      totalHours: round(day.totalHours),
      issues: day.issues.sort((a, b) => b.hours - a.hours || a.code.localeCompare(b.code, 'es')),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
