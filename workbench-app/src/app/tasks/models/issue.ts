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
  /** ISO si la tarea está cerrada (historial); null si está abierta. */
  closedAt: string | null;
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
  /**
   * Estados que se muestran: ids de estado y `none` (sin estado). `null` = los de siempre: todos
   * menos los finalizados.
   */
  stateKeys: string[] | null;
  labelId: string;
  origin: 'all' | 'plane' | 'local';
  /** `open`: pendientes y finalizadas. `closed`: el historial. */
  view: 'open' | 'closed';
}

export const DEFAULT_ISSUE_FILTERS: IssueFilters = {
  search: '',
  projectId: 'all',
  stateKeys: null,
  labelId: 'all',
  origin: 'all',
  view: 'open',
};

/** Clave del estado de una tarea para el filtro (`none` si no tiene). */
export function stateKey(issue: Pick<Issue, 'stateId'>): string {
  return issue.stateId ?? 'none';
}

/** Código de la tarea: `MEL-123` si el proyecto tiene identificador de Plane; si no, `#12`. */
export function issueCode(
  issue: Pick<Issue, 'remoteSequence' | 'localSequence'>,
  identifier: string | null | undefined,
): string {
  const number = issueNumber(issue);
  return identifier ? `${identifier}-${number}` : `#${number}`;
}

/** Número visible de la tarea dentro de su proyecto (`#12`). */
export function issueNumber(issue: Pick<Issue, 'remoteSequence' | 'localSequence'>): number {
  return issue.remoteSequence ?? issue.localSequence;
}

export function priorityLabel(priority: string | null): string {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? 'Sin prioridad';
}
