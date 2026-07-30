// tasks/infrastructure/clients/plane-api.types.ts

export type PlaneList<T> = { results: T[] } | T[];

export interface PlaneUser {
  id: string;
}

export interface PlaneProject {
  id: string;
  name: string;
}

export interface PlaneProjectMember {
  id: string;
  member: string;
  role: number;
}

export interface PlaneStateDetail {
  name: string;
}

export interface PlaneIssue {
  id: string;
  sequence_id: number;
  name: string;
  description_html: string | null;
  state: string;
  state_detail?: PlaneStateDetail | null;
  priority: string | null;
  start_date: string | null;
  target_date: string | null;
  assignees?: string[];
}
