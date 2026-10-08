import { Issue, issueCode } from '@tasks/index';
import { IssueHours } from '../models/time-report';

/** Lo que el dashboard necesita saber de un proyecto. */
export interface ProjectRef {
  id: string;
  name: string;
  identifier: string | null;
}

export interface WorkedIssue {
  id: string;
  name: string;
  /** `MEL-123`, o `#12` si el proyecto no tiene identificador. */
  code: string;
  hours: number;
}

export interface WorkedProject {
  /** `null` para las horas de tareas que no se pudieron resolver. */
  id: string | null;
  name: string;
  /** Suma de las horas de todas sus tareas. */
  totalHours: number;
  issues: WorkedIssue[];
}

const UNKNOWN_PROJECT = 'Sin proyecto';

/** Evita arrastrar errores de coma flotante al sumar horas decimales. */
const round = (hours: number) => Math.round(hours * 100) / 100;

/**
 * Agrupa las horas por tarea en proyectos: cada proyecto con la suma de sus horas y sus tareas de
 * la que más tiene a la que menos; los proyectos van del que más horas tiene al que menos.
 */
export function groupByProject(
  byIssue: readonly IssueHours[],
  issues: ReadonlyMap<string, Issue>,
  projects: ReadonlyMap<string, ProjectRef>,
): WorkedProject[] {
  const groups = new Map<string | null, WorkedProject>();

  for (const { issueId, hours } of byIssue) {
    const issue = issues.get(issueId);
    const project = issue ? projects.get(issue.projectId) : undefined;
    const key = project?.id ?? null;

    let group = groups.get(key);
    if (!group) {
      group = { id: key, name: project?.name ?? UNKNOWN_PROJECT, totalHours: 0, issues: [] };
      groups.set(key, group);
    }

    group.totalHours += hours;
    group.issues.push({
      id: issueId,
      name: issue?.name ?? 'Tarea no disponible',
      code: issue ? issueCode(issue, project?.identifier) : '—',
      hours,
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      totalHours: round(group.totalHours),
      issues: group.issues.sort((a, b) => b.hours - a.hours || a.code.localeCompare(b.code, 'es')),
    }))
    .sort((a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name, 'es'));
}
