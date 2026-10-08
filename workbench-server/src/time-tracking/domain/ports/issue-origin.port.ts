/** Origen de las tareas, que vive en el módulo de tareas: aquí solo se pregunta cuáles son locales. */
export interface IssueOriginPort {
  /** De las tareas dadas, los ids de las que son locales (no vienen de Plane). */
  findLocalIds(issueIds: readonly string[]): Promise<Set<string>>;
}

export const ISSUE_ORIGIN_PORT = Symbol('IssueOriginPort');
