import { ExternalSource } from '@tasks/domain/entities/task-project.props';

export class TaskProjectResponseDto {
  id!: string;
  name!: string;
  externalId!: string | null;
  source!: ExternalSource | null;
  identifier!: string | null;
  /** Base de los enlaces a las tareas en Plane (`…/browse/`); null en los proyectos locales. */
  ticketBaseUrl!: string | null;
  syncEnabled!: boolean;
  visible!: boolean;
  /** Los proyectos (repositorios) que usan las tareas de este proyecto de tareas que no tienen los suyos. */
  defaultProjectRepos!: string[];
  syncedAt!: string | null;
  createdAt!: string;
}
