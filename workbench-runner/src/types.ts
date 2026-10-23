export type JobKind = 'tickets' | 'develop' | 'review' | 'publish';

/** Un trabajo tal como lo manda el servidor (`runner/jobs/claim`). */
export interface RunnerJob {
  id: string;
  executionId: string;
  kind: JobKind;
  attempt: number;
  payload: JobPayload;
}

export interface JobPayload {
  /** `null` en los trabajos que no usan un agente (publicar la rama). */
  agent: JobAgent | null;
  prompt: string;
  repo: { sshUrl: string; fullName: string };
  branch: string;
  commitMessage?: string;
  reviewFrom?: string;
}

export interface JobAgent {
  name: string;
  model: string;
  systemPrompt: string;
  allowedTools: string[];
}

/** Lo que se devuelve al servidor al terminar un trabajo. */
export interface JobResult {
  output?: string;
  headBefore?: string;
  headAfter?: string;
  baseBranch?: string;
}

export interface JobOutcome {
  result: JobResult;
  costUsd: number | null;
}
