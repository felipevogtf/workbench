import { StageKey } from './execution.props';

export type JobKind = StageKey;
export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

/** El agente tal como lo recibe el runner: ya resuelto por el servidor. */
export interface JobAgent {
  /** El agente (de la tabla de agentes) que hace el trabajo: así la app muestra a quién estaba asignado. */
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  allowedTools: string[];
  /** Esfuerzo con que trabaja (`claude --effort`); ausente = el del modelo. */
  effort?: string;
}

/** Todo lo que el runner necesita para hacer un trabajo. */
export interface JobPayload {
  /** `null` en los trabajos que no usan un agente (publicar la rama). */
  agent: JobAgent | null;
  prompt: string;
  repo: { sshUrl: string; fullName: string };
  branch: string;
  /** Solo en `develop`: mensaje del commit que el runner hace al terminar. */
  commitMessage?: string;
  /** Solo en `review`: commit desde el que se revisa. */
  reviewFrom?: string;
}

/** Lo que el runner devuelve al terminar. */
export interface JobResult {
  /** Salida final del agente. */
  output?: string;
  /** `develop`: commit antes y después de trabajar. */
  headBefore?: string;
  headAfter?: string;
  /** `publish`: rama destino de la PR. */
  baseBranch?: string;
}

export interface JobProps {
  id: string;
  executionId: string;
  kind: JobKind;
  ticketId: string | null;
  status: JobStatus;
  payload: JobPayload;
  result: JobResult | null;
  logs: string;
  error: string | null;
  runnerId: string | null;
  attempt: number;
  costUsd: number | null;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
