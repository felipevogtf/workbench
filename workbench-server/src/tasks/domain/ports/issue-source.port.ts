export interface RemoteIssueData {
  externalId: string;
  sequenceNumber: number;
  name: string;
  description: string | null;
  externalState: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  /** Estimado de Plane (horas o puntos, según cómo lo use el proyecto); null si no tiene. */
  estimatePoint: number | null;
}

export interface IssueSourcePort {
  getIssuesByProject(projectExternalId: string): Promise<RemoteIssueData[]>;
}

export const ISSUE_SOURCE_PORT = Symbol('ISSUE_SOURCE_PORT');
