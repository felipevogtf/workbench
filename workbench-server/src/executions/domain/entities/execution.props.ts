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

/** `waiting`: el desarrollador hizo una pregunta y el ticket espera la respuesta (de Lucy o del usuario). */
export type TicketStatus =
  'pending' | 'developing' | 'reviewing' | 'waiting' | 'done' | 'failed';

/** Lo que un desarrollador preguntó porque no podía seguir sin una respuesta. */
export interface TicketQuestion {
  id: string;
  /** Quién preguntó (su nombre para mostrar) y su agente. */
  from: string;
  agentId: string | null;
  text: string;
  /** Lo que Lucy recomienda contestar; `null` mientras decide o si no pudo. */
  recommendation: string | null;
  askedAt: string;
}

/** Una pregunta ya contestada, por Lucy o por el usuario: el desarrollador la recibe al retomar. */
export interface TicketDecision {
  at: string;
  from: 'user' | 'lucy';
  question: string;
  text: string;
}

/** Algo que un agente dejó dudoso sin detenerse (un supuesto, algo sin probar); Lucy se lo comenta al usuario. */
export interface TicketDoubt {
  id: string;
  at: string;
  /** Quién la dejó (el nombre con que se ve al agente). */
  from: string;
  text: string;
}

/** Una instrucción para quien trabaje el ticket, del usuario o de Lucy: entra a su prompt la próxima vez. */
export interface TicketNote {
  at: string;
  from: 'user' | 'lucy';
  text: string;
}

/** Trabajo de la ejecución: lo crea el agente de tickets a partir del plan. */
export interface ExecutionTicket {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  /** Por dónde empezar (pista de Lucy, no un límite); ausente en las ejecuciones anteriores a este campo. */
  files?: string[];
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
  /** La pregunta que espera respuesta (el ticket está en `waiting`); `null` si no hay. */
  question: TicketQuestion | null;
  /** Las preguntas ya contestadas, de la más antigua a la más nueva. */
  decisions: TicketDecision[];
  /** Instrucciones dejadas para este ticket; ausente en los anteriores a este campo. */
  notes?: TicketNote[];
  /** Dudas que dejaron los agentes al avanzar; ausente en los anteriores a este campo. */
  doubts?: TicketDoubt[];
  /** Cuántas preguntas ha hecho el desarrollador en este ticket (hay un tope). */
  questionsAsked: number;
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

/** Cuánto importa un hallazgo de la revisión final. */
export const FINDING_SEVERITIES = ['high', 'medium', 'low'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

/** Un problema que la revisión final encontró en la rama completa. */
export interface FinalReviewFinding {
  severity: FindingSeverity;
  /** El archivo al que se refiere, si se refiere a uno. */
  file: string | null;
  issue: string;
  suggestion: string;
}

/**
 * La revisión de toda la rama que el usuario pide cuando la ejecución terminó: un agente revisor compara el diff
 * completo con el plan, los criterios de los tickets y las recetas. Es un informe: no cambia nada por sí sola.
 */
export interface FinalReview {
  status: 'running' | 'done' | 'failed';
  requestedAt: string;
  finishedAt: string | null;
  summary: string | null;
  findings: FinalReviewFinding[];
  error: string | null;
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
  /** `false`: al terminar solo sube la rama, sin abrir la PR (una prueba). Ausente = se abre. */
  openPullRequest?: boolean;
  error: string | null;
  /** La revisión final pedida por el usuario; ausente si nunca se pidió. */
  finalReview?: FinalReview | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}
