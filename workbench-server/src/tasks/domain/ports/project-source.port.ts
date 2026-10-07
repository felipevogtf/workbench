export interface RemoteProjectData {
  externalId: string;
  name: string;
  identifier: string | null;
}

export interface ProjectSourcePort {
  getProjects(): Promise<RemoteProjectData[]>;
}

export const PROJECT_SOURCE_PORT = Symbol('PROJECT_SOURCE_PORT');
