/** Tokens que gastó una llamada a Claude (o la suma de varias). */
export interface UsageTokens {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** Una ventana del plan (5 horas o semanal): qué fracción (0 a 1) se lleva usada y cuándo se reinicia. */
export interface UsageWindow {
  used: number;
  /** ISO. */
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

export const NO_TOKENS: UsageTokens = {
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
};

export function addTokens(a: UsageTokens, b: UsageTokens): UsageTokens {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheRead: a.cacheRead + b.cacheRead,
  };
}

export function totalTokens(tokens: UsageTokens): number {
  return tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead;
}

/** Un número finito y no negativo; cualquier otra cosa cuenta como cero. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function parseWindow(raw: unknown): UsageWindow | null {
  if (!raw || typeof raw !== 'object') return null;
  const { used, resetsAt } = raw as { used?: unknown; resetsAt?: unknown };
  if (typeof used !== 'number' || !Number.isFinite(used) || used < 0) {
    return null;
  }
  if (typeof resetsAt !== 'string' || Number.isNaN(Date.parse(resetsAt))) {
    return null;
  }
  return {
    used: Math.min(used, 1.5),
    resetsAt: new Date(resetsAt).toISOString(),
  };
}

/** Lo que el runner dice del plan, revisado: viene de fuera, así que no se confía en su forma. */
export function parseLimits(raw: unknown): UsageLimits | null {
  if (!raw || typeof raw !== 'object') return null;
  const { fiveHour, sevenDay } = raw as {
    fiveHour?: unknown;
    sevenDay?: unknown;
  };
  const limits = {
    fiveHour: parseWindow(fiveHour),
    sevenDay: parseWindow(sevenDay),
  };
  return limits.fiveHour || limits.sevenDay ? limits : null;
}

export function parseTokens(raw: unknown): UsageTokens {
  const tokens = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    input: count(tokens.input),
    output: count(tokens.output),
    cacheWrite: count(tokens.cacheWrite),
    cacheRead: count(tokens.cacheRead),
  };
}

export function parseJobUsage(raw: unknown): JobUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const { tokens, limits } = raw as { tokens?: unknown; limits?: unknown };
  return { tokens: parseTokens(tokens), limits: parseLimits(limits) };
}

/** Cómo iba el plan en un momento: lo informa cada trabajo y cada medida mínima. */
export interface UsageSnapshot {
  id: string;
  takenAt: Date;
  limits: UsageLimits;
  source: 'job' | 'probe';
  jobId: string | null;
}
