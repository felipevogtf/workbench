export type ExternalSource = 'plane' | 'jira';

export interface TaskProjectProps {
  id: string;
  name: string;
  externalId: string | null;
  source: ExternalSource | null;
  /** Prefijo de las claves de ticket en Plane (`MEL`); null en los locales. */
  identifier: string | null;
  /** Si el sync (cron y botón) trae las tareas de este proyecto de Plane. */
  syncEnabled: boolean;
  /** Si el proyecto y sus tareas aparecen en la app (selectores y listados). */
  visible: boolean;
  /** Los proyectos (repositorios `org/repo`) que se usan en las tareas de este proyecto de tareas que no tienen los suyos. */
  defaultProjectRepos: string[];
  syncedAt: Date | null;
  createdAt: Date;
}
