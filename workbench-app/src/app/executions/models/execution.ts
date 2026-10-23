import type { BadgeTone } from '@shared/ui/badge/badge';

export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type StageKey = 'tickets' | 'develop' | 'review' | 'publish';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed';
export type TicketStatus = 'pending' | 'developing' | 'reviewing' | 'done' | 'failed';
export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface StageRun {
  key: StageKey;
  status: StageStatus;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Trabajo en que el agente de tickets dividió el plan. */
export interface ExecutionTicket {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  status: TicketStatus;
  /** Revisiones que ya tuvo. */
  rounds: number;
  /** Lo que el revisor pidió corregir en su última revisión. */
  feedback: string[] | null;
  summary: string | null;
  reviewNote: string | null;
}

export interface Execution {
  id: string;
  issueId: string;
  repo: { url: string; host: string; fullName: string; sshUrl: string };
  branch: string;
  baseBranch: string | null;
  status: ExecutionStatus;
  stages: StageRun[];
  tickets: ExecutionTicket[];
  pullRequestUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface JobSummary {
  id: string;
  kind: StageKey;
  ticketId: string | null;
  status: JobStatus;
  attempt: number;
  costUsd: number | null;
  error: string | null;
  runnerId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ExecutionDetail extends Execution {
  jobs: JobSummary[];
  /** Hay trabajo en cola y ningún runner conectado para hacerlo. */
  waitingForRunner: boolean;
  costUsd: number;
}

export interface JobLogs {
  logs: string;
  status: JobStatus;
}

export interface Runner {
  id: string;
  name: string;
  version: string | null;
  host: string | null;
  lastSeenAt: string | null;
  online: boolean;
  createdAt: string;
}

export interface CreatedRunner extends Runner {
  /** Solo se muestra una vez, al crear el runner. */
  token: string;
}

/** En marcha: mientras lo esté, la pantalla se refresca sola. */
export function isExecutionActive(execution: Pick<Execution, 'status'>): boolean {
  return execution.status === 'running';
}

export const STAGE_LABEL: Record<StageKey, string> = {
  tickets: 'Tickets',
  develop: 'Desarrollo',
  review: 'Revisión',
  publish: 'Rama y PR',
};

export const STAGE_HINT: Record<StageKey, string> = {
  tickets: 'Un agente divide el plan en tickets',
  develop: 'Otro agente desarrolla cada ticket',
  review: 'Un revisor comprueba cada ticket',
  publish: 'Se sube la rama y se abre la PR',
};

export const EXECUTION_STATUS_LABEL: Record<ExecutionStatus, string> = {
  running: 'En curso',
  completed: 'Completada',
  failed: 'Falló',
  cancelled: 'Cancelada',
};

export const EXECUTION_STATUS_TONE: Record<ExecutionStatus, BadgeTone> = {
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  pending: 'Pendiente',
  developing: 'Desarrollando',
  reviewing: 'En revisión',
  done: 'Hecho',
  failed: 'Falló',
};

export const TICKET_STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  pending: 'neutral',
  developing: 'info',
  reviewing: 'info',
  done: 'success',
  failed: 'danger',
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'En cola',
  running: 'Corriendo',
  done: 'Listo',
  failed: 'Falló',
  cancelled: 'Cancelado',
};

export const JOB_STATUS_TONE: Record<JobStatus, BadgeTone> = {
  pending: 'neutral',
  running: 'info',
  done: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

/** El costo de un trabajo o de toda la ejecución, para mostrar. */
export function formatCost(usd: number | null): string {
  if (usd === null) return '—';
  return usd < 0.01 && usd > 0 ? '<$0.01' : `$${usd.toFixed(2)}`;
}
