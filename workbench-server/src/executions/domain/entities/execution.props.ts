export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled';

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

export interface ExecutionProps {
  id: string;
  issueId: string;
  planId: string;
  repo: ExecutionRepo;
  branch: string;
  baseBranch: string | null;
  status: ExecutionStatus;
  stages: StageRun[];
  tickets: ExecutionTicket[];
  pullRequestUrl: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}
