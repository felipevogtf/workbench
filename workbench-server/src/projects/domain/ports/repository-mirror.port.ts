/** La copia compartida del repositorio de un proyecto, en el servidor. */
export interface RepositoryMirrorPort {
  /** Deja lista la copia del enlace (la clona o la actualiza). Nunca falla: si no se puede, se intenta de nuevo al usarla. */
  prepare(repoUrl: string): Promise<void>;
  /** Borra la copia del enlace. Nunca falla: es limpieza. */
  discard(repoUrl: string): Promise<void>;
}

export const REPOSITORY_MIRROR_PORT = Symbol('PROJECTS_REPOSITORY_MIRROR_PORT');
