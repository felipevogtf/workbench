export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export const PRIORITY_OPTIONS: readonly { value: IssuePriority; label: string }[] = [
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
  { value: 'none', label: 'Sin prioridad' },
];

export interface Issue {
  id: string;
  name: string;
  /** `false`: viene de Plane (nombre, descripción, prioridad y fechas solo cambian con el sync). */
  isLocal: boolean;
  externalId: string | null;
  remoteSequence: number | null;
  localSequence: number;
  externalState: string | null;
  description: string | null;
  priority: string | null;
  estimatedHours: number | null;
  stateId: string | null;
  projectId: string;
  labelIds: string[];
  /** `YYYY-MM-DD`. */
  startDate: string | null;
  dueDate: string | null;
}

/** Campos editables. `undefined` = sin cambios; `null` = limpiar el valor. */
export interface IssueInput {
  name: string;
  projectId: string;
  description?: string | null;
  stateId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  labelIds?: string[];
}

export interface IssueFilters {
  search: string;
  projectId: string;
  /** `all`, `none` (sin estado) o el id de un estado. */
  stateId: string;
  labelId: string;
  origin: 'all' | 'plane' | 'local';
}

export const DEFAULT_ISSUE_FILTERS: IssueFilters = {
  search: '',
  projectId: 'all',
  stateId: 'all',
  labelId: 'all',
  origin: 'all',
};

/** Número visible de la tarea dentro de su proyecto (`#12`). */
export function issueNumber(issue: Pick<Issue, 'remoteSequence' | 'localSequence'>): number {
  return issue.remoteSequence ?? issue.localSequence;
}

export function priorityLabel(priority: string | null): string {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? 'Sin prioridad';
}
