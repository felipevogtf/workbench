import type { BadgeTone } from '@shared/ui/badge/badge';
import type { ExecutionUsage } from './usage';

/** `awaiting`: los tickets están listos y asignados; se espera el visto bueno del usuario. */
export type ExecutionStatus = 'running' | 'awaiting' | 'completed' | 'failed' | 'cancelled';
export type TicketLevel = 'simple' | 'medium' | 'complex';
export type StageKey = 'tickets' | 'develop' | 'review' | 'publish';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed';
/** `waiting`: el desarrollador hizo una pregunta y el ticket espera la respuesta. */
export type TicketStatus = 'pending' | 'developing' | 'reviewing' | 'waiting' | 'done' | 'failed';
export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface StageRun {
  key: StageKey;
  status: StageStatus;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Lo que un desarrollador preguntó porque no podía seguir sin una respuesta. */
export interface TicketQuestion {
  id: string;
  /** Quién preguntó, con el nombre con que se ve en la app. */
  from: string;
  agentId: string | null;
  text: string;
  /** Lo que Lucy recomienda contestar; `null` mientras lo piensa o si no pudo. */
  recommendation: string | null;
  askedAt: string;
}

/** Una pregunta ya contestada (por Lucy o por el usuario): el desarrollador retomó con ella. */
export interface TicketDecision {
  at: string;
  from: 'user' | 'lucy';
  question: string;
  text: string;
}

/** Trabajo en que el agente de tickets dividió el plan. */
export interface ExecutionTicket {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  /** `organización/repo` en que se desarrolla; ausente si la tarea tiene un solo repositorio. */
  repo?: string;
  level: TicketLevel;
  /** El desarrollador asignado; `null` = el que esté por defecto. */
  developerId: string | null;
  /** El revisor asignado; `null` = el que esté por defecto. */
  reviewerId: string | null;
  status: TicketStatus;
  /** Revisiones que ya tuvo. */
  rounds: number;
  /** Lo que el revisor pidió corregir en su última revisión. */
  feedback: string[] | null;
  summary: string | null;
  reviewNote: string | null;
  /** La pregunta que espera respuesta; `null` si no hay. */
  question: TicketQuestion | null;
  /** Las preguntas ya contestadas. */
  decisions: TicketDecision[];
  questionsAsked: number;
  /** Commit de la rama antes y después de desarrollar el ticket. */
  startSha?: string | null;
  headSha?: string | null;
}

/** Un repositorio de la ejecución con su rama y su PR (una tarea puede tocar varios). */
export interface ExecutionRepoTarget {
  repo: { url: string; host: string; fullName: string; sshUrl: string };
  branch: string;
  baseBranch: string | null;
  pullRequestUrl: string | null;
  /** El primero: el que se muestra en el resumen. */
  primary: boolean;
}

export interface Execution {
  id: string;
  issueId: string;
  repo: { url: string; host: string; fullName: string; sshUrl: string };
  branch: string;
  baseBranch: string | null;
  /** Todos los repositorios de la tarea, el primero igual que `repo`. */
  repos: ExecutionRepoTarget[];
  status: ExecutionStatus;
  stages: StageRun[];
  tickets: ExecutionTicket[];
  pullRequestUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

/** Una ejecución en el historial general: con el nombre de su tarea (`null` si ya no existe). */
export interface ExecutionListItem extends Execution {
  issueName: string | null;
}

export interface JobSummary {
  id: string;
  kind: StageKey;
  ticketId: string | null;
  status: JobStatus;
  attempt: number;
  costUsd: number | null;
  /** Tokens que gastó (entrada, salida y caché); `null` en los trabajos anteriores a medirlo. */
  tokens: number | null;
  error: string | null;
  runnerId: string | null;
  /** El agente que hizo (o hará) el trabajo; `null` en los que no usan uno. */
  agentId: string | null;
  /** Nombre técnico del agente; sirve para reconocer a los de trabajos viejos, que no guardaron su id. */
  agentName: string | null;
  /** El resumen del desarrollador (solo en los trabajos de desarrollo). */
  output: string | null;
  /** El veredicto del revisor (solo en las revisiones terminadas). */
  review: { approved: boolean; summary: string; issues: string[] } | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ExecutionDetail extends Execution {
  jobs: JobSummary[];
  /** Hay trabajo en cola y ningún runner conectado para hacerlo. */
  waitingForRunner: boolean;
  costUsd: number;
  /** Lo que gastó la ejecución: tokens exactos y lo que costó del plan (medido y estimado). */
  usage: ExecutionUsage;
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
  /** El que toma el trabajo primero y al que la app intenta despertar. */
  isDefault: boolean;
  createdAt: string;
}

export interface CreatedRunner extends Runner {
  /** Solo se muestra una vez, al crear el runner. */
  token: string;
}

/** En curso (trabajando o esperando el visto bueno): no se puede lanzar otra de la misma tarea. */
export function isExecutionActive(execution: Pick<Execution, 'status'>): boolean {
  return execution.status === 'running' || execution.status === 'awaiting';
}

export const TICKET_LEVEL_LABEL: Record<TicketLevel, string> = {
  simple: 'Simple',
  medium: 'Medio',
  complex: 'Complejo',
};

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
  awaiting: 'Esperando tu visto bueno',
  completed: 'Completada',
  failed: 'Falló',
  cancelled: 'Cancelada',
};

export const EXECUTION_STATUS_TONE: Record<ExecutionStatus, BadgeTone> = {
  running: 'info',
  awaiting: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  pending: 'Pendiente',
  developing: 'Desarrollando',
  reviewing: 'En revisión',
  waiting: 'Esperando respuesta',
  done: 'Hecho',
  failed: 'Falló',
};

export const TICKET_STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  pending: 'neutral',
  developing: 'info',
  reviewing: 'info',
  waiting: 'warning',
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

/** Dónde va una ejecución en marcha, en una frase; `null` si no está en marcha. */
export function executionProgress(
  execution: Pick<Execution, 'status' | 'tickets'> | null,
): string | null {
  if (!execution || execution.status !== 'running') return null;
  const tickets = execution.tickets;
  if (tickets.length === 0) return 'Creando los tickets del plan…';

  const index = tickets.findIndex((ticket) => ticket.status !== 'done');
  if (index === -1) return 'Subiendo la rama y abriendo la PR…';
  return `Ticket ${index + 1} de ${tickets.length}: ${TICKET_STATUS_LABEL[tickets[index].status]}`;
}

/** Un trabajador (agente) tal como se ve en pantalla. */
export interface Worker {
  name: string;
  avatar: string | null;
}

/** Una tarjeta del tablero: un ticket con quién lo tiene asignado. */
export interface BoardCard {
  ticket: ExecutionTicket;
  /** Su lugar en la lista (desde 1). */
  number: number;
  worker: Worker | null;
  /** El repositorio del ticket, solo cuando la tarea tiene más de uno. */
  repo?: string | null;
  /** Todavía no lo toma: es el que lo hará cuando le toque. */
  upcoming: boolean;
}
