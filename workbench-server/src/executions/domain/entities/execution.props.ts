/** `awaiting`: los tickets están creados y asignados, y se espera a que el usuario dé el visto bueno. */
export type ExecutionStatus =
  'running' | 'awaiting' | 'completed' | 'failed' | 'cancelled';

/** Tamaño de un ticket: decide qué desarrollador lo toma. */
export const TICKET_LEVELS = ['simple', 'medium', 'complex'] as const;
export type TicketLevel = (typeof TICKET_LEVELS)[number];

/** Etapas del flujo base, en orden. */
export const STAGE_KEYS = ['tickets', 'develop', 'review', 'publish'] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export type StageStatus = 'pending' | 'running' | 'done' | 'failed';

export interface StageRun {
  key: StageKey;
  status: StageStatus;
  startedAt: string | null;
  finishedAt: string | null;
}

export type TicketStatus =
  'pending' | 'developing' | 'reviewing' | 'done' | 'failed';

/** Trabajo de la ejecución: lo crea el agente de tickets a partir del plan. */
export interface ExecutionTicket {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  /** `organización/repo` en que se desarrolla; ausente en las ejecuciones de un solo repo. */
  repo?: string;
  level: TicketLevel;
  /** El desarrollador asignado; `null` = el que esté por defecto. */
  developerId: string | null;
  /** El revisor asignado; `null` = el que esté por defecto. */
  reviewerId: string | null;
  status: TicketStatus;
  /** Revisiones ya hechas de este ticket. */
  rounds: number;
  /** Lo que el revisor pidió corregir en la última revisión; null si no hay nada pendiente. */
  feedback: string[] | null;
  /** Último commit de la rama antes de empezar el ticket. */
  startSha: string | null;
  /** Último commit tras desarrollarlo. */
  headSha: string | null;
  /** Resumen del desarrollador. */
  summary: string | null;
  /** Lo que dijo el revisor en su última revisión. */
  reviewNote: string | null;
}

export interface ExecutionRepo {
  /** Enlace https del repositorio, tal como está en la etiqueta de la tarea. */
  url: string;
  host: string;
  /** `organización/repo`. */
  fullName: string;
  sshUrl: string;
}

/**
 * Un repositorio más de la tarea (el primero va en `repo`, `branch`, `baseBranch` y `pullRequestUrl`):
 * cada uno tiene su rama y abre su propia PR.
 */
export interface ExecutionExtraRepo {
  repo: ExecutionRepo;
  branch: string;
  baseBranch: string | null;
  pullRequestUrl: string | null;
}

/** Un repositorio de la ejecución con su rama y su PR, sea el primero o uno de los demás. */
export interface ExecutionTarget extends ExecutionExtraRepo {
  /** El primero: el que se ve en el resumen y al que van los tickets sin repo. */
  primary: boolean;
}

export interface ExecutionProps {
  id: string;
  issueId: string;
  planId: string;
  repo: ExecutionRepo;
  branch: string;
  baseBranch: string | null;
  /** Los demás repositorios de la tarea, si toca más de uno. */
  extraRepos: ExecutionExtraRepo[];
  status: ExecutionStatus;
  stages: StageRun[];
  tickets: ExecutionTicket[];
  pullRequestUrl: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}
