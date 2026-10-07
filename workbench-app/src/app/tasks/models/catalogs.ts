export interface Project {
  id: string;
  name: string;
  externalId: string | null;
  /** `null` = proyecto local; `plane` = viene de Plane y solo se actualiza con el sync. */
  source: 'plane' | 'jira' | null;
  /** Prefijo de las claves de Plane (`MEL`); null en los proyectos locales. */
  identifier: string | null;
  /** Base de los enlaces a Plane (`…/browse/`); null en los proyectos locales. */
  ticketBaseUrl: string | null;
  syncedAt: string | null;
  createdAt: string;
}

/** Los estados son globales (no por proyecto) y su orden es el de las columnas del kanban. */
export interface State {
  id: string;
  name: string;
  color: string | null;
  position: number;
  /** Una tarea en este estado está finalizada: sale de los pendientes (pero se puede ver). */
  isFinal: boolean;
}

export interface StateInput {
  name: string;
  color: string | null;
  isFinal?: boolean;
}

export interface Label {
  id: string;
  name: string;
  color: string | null;
  /** Repositorio asociado: el planificador lo lee para las tareas con esta etiqueta. */
  repoUrl: string | null;
}

export interface LabelInput extends StateInput {
  repoUrl?: string | null;
}

export interface Counts {
  created: number;
  updated: number;
}

export interface SyncResult {
  projects: Counts;
  issues: Counts;
  failedProjects: { id: string; name: string; message: string }[];
}

export interface TimeEntry {
  id: string;
  issueId: string;
  hours: number;
  /** `YYYY-MM-DD`. */
  date: string;
}

export interface TimeEntryInput {
  issueId: string;
  hours: number;
  date: string;
}
