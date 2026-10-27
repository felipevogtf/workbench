/** `final` es la revisión de toda la rama que el usuario pide cuando la ejecución ya terminó. */
export type JobKind = 'tickets' | 'develop' | 'review' | 'publish' | 'final';

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
  /** Los otros repositorios de la tarea: se dejan a la vista del agente, solo para leer. */
  context?: { sshUrl: string; fullName: string; branch: string }[];
  commitMessage?: string;
  reviewFrom?: string;
}

export interface JobAgent {
  name: string;
  /** El nombre con que se conoce al agente (Rebecca, David…); firma sus commits. Ausente = se usa `name`. */
  displayName?: string;
  model: string;
  systemPrompt: string;
  allowedTools: string[];
  /** Esfuerzo con que trabaja (`claude --effort`); ausente = el del modelo. */
  effort?: string;
}

/** Lo que se devuelve al servidor al terminar un trabajo. */
export interface JobResult {
  output?: string;
  headBefore?: string;
  headAfter?: string;
  baseBranch?: string;
}

/** Tokens que gastó una llamada a Claude. */
export interface UsageTokens {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** Una ventana del plan (5 horas o semanal): qué fracción (0 a 1) se lleva usada y cuándo se reinicia. */
export interface UsageWindow {
  used: number;
  resetsAt: string;
}

export interface UsageLimits {
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
}

/** Lo que gastó un trabajo y cómo iba el plan mientras corría. */
export interface JobUsage {
  tokens: UsageTokens;
  limits: UsageLimits | null;
}

export interface JobOutcome {
  result: JobResult;
  costUsd: number | null;
  usage?: JobUsage;
}
