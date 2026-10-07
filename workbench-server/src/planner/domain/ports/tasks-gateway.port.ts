export interface TaskLabel {
  name: string;
  /** Repositorio de la etiqueta (ya normalizado), o null. */
  repoUrl: string | null;
}

/** Lo que el planificador necesita saber de una tarea. */
export interface TaskContext {
  id: string;
  name: string;
  /** Texto plano (el HTML de Plane ya convertido). */
  description: string | null;
  projectName: string | null;
  stateName: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  /** `true` si se creó en el workbench; `false` si viene de Plane. */
  isLocal: boolean;
  labels: TaskLabel[];
}

/** Contrato propio del planificador hacia el módulo tasks. */
export interface TasksGatewayPort {
  /** `null` si la tarea no existe. */
  getTask(issueId: string): Promise<TaskContext | null>;
}

export const TASKS_GATEWAY_PORT = Symbol('PLANNER_TASKS_GATEWAY_PORT');
