export interface Project {
  id: string;
  name: string;
  externalId: string | null;
  /** `null` = proyecto local; `plane` = viene de Plane y solo se actualiza con el sync. */
  source: 'plane' | 'jira' | null;
  syncedAt: string | null;
  createdAt: string;
}

/** Los estados son globales (no por proyecto) y su orden es el de las columnas del kanban. */
export interface State {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

export interface StateInput {
  name: string;
  color: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string | null;
}

export type LabelInput = StateInput;

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
