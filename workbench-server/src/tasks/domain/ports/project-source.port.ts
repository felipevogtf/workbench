export interface RemoteProjectData {
  externalId: string;
  name: string;
}

export interface ProjectSourcePort {
  getProjects(): Promise<RemoteProjectData[]>;
}

export const PROJECT_SOURCE_PORT = Symbol('PROJECT_SOURCE_PORT');
