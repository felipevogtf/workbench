/** Una ventana del plan (5 horas o semanal): qué fracción (0 a 1) se lleva usada y cuándo se reinicia. */
export interface UsageWindow {
  used: number;
  /** ISO. */
  resetsAt: string;
}

/** Lo que subió una ventana mientras corría una ejecución (fracciones de 0 a 1). */
export interface WindowChange {
  from: number;
  to: number;
  delta: number;
}

export interface UsageTokens {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** Lo que gastó una ejecución: los tokens son exactos; el porcentaje de la cuenta, medido o estimado. */
export interface ExecutionUsage {
  tokens: UsageTokens & { total: number };
  costUsd: number;
  /** Lo que subió la ventana mientras corría: incluye cualquier otro uso de la cuenta en ese rato. */
  measured: { fiveHour: WindowChange | null; sevenDay: WindowChange | null };
  /** Puntos porcentuales estimados con la calibración; `null` si todavía no hay con qué calibrar. */
  estimatedPoints: { fiveHour: number | null; sevenDay: number | null };
}

export interface DayUsage {
  /** `2026-10-25`, en la zona horaria de quien mira. */
  date: string;
  tokens: number;
  costUsd: number;
  /** Tokens por etapa (`tickets`, `develop`, `review`, `publish`). */
  byKind: Record<string, number>;
  /** Puntos de la semana que habría costado; `null` sin calibración. */
  estimatedPoints: number | null;
}

export interface UsageOverview {
  current: {
    fiveHour: UsageWindow | null;
    sevenDay: UsageWindow | null;
    takenAt: string | null;
    ageSeconds: number | null;
  };
  refreshing: boolean;
  calibration: {
    fiveHour: { costPerPoint: number | null; samples: number };
    sevenDay: { costPerPoint: number | null; samples: number };
  };
  days: DayUsage[];
  today: { tokens: number; costUsd: number; estimatedPoints: number | null };
  week: { tokens: number; costUsd: number; estimatedPoints: number | null };
}

/** Sin ejecuciones medidas todavía: el valor de las que no traen datos. */
export const NO_USAGE: ExecutionUsage = {
  tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, total: 0 },
  costUsd: 0,
  measured: { fiveHour: null, sevenDay: null },
  estimatedPoints: { fiveHour: null, sevenDay: null },
};

const TOKENS = new Intl.NumberFormat('es-CL');

/** `412.000`. */
export function formatTokens(tokens: number): string {
  return TOKENS.format(Math.round(tokens));
}

/** `24 %` a partir de una fracción de 0 a 1. */
export function formatFraction(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}

/** `≈ 6 %`, `≈ 0,8 %` o `< 0,1 %` a partir de puntos porcentuales. */
export function formatPoints(points: number): string {
  if (points < 0.1) return '< 0,1 %';
  const rounded = points >= 10 ? Math.round(points) : Math.round(points * 10) / 10;
  return `≈ ${rounded.toLocaleString('es-CL')} %`;
}

/** `en 4 h 25 min`, `en 12 min`, `en 2 d 3 h`; `ya` si pasó. */
export function untilText(iso: string, now: number): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60_000);
  if (minutes <= 0) return 'ya se reinició';
  if (minutes < 60) return `en ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest ? `en ${hours} h ${rest} min` : `en ${hours} h`;
  }
  return `en ${Math.floor(hours / 24)} d ${hours % 24} h`;
}

/** `lunes 26 oct, 03:40`. */
export function resetText(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Lo que se dice del consumo de una ejecución, listo para mostrar; `null` si no hay nada que decir. */
export function describeUsage(usage: ExecutionUsage | undefined): {
  tokens: string;
  estimate: string | null;
  measured: string | null;
  detail: string;
} | null {
  if (!usage || usage.tokens.total === 0) return null;

  const { fiveHour, sevenDay } = usage.estimatedPoints;
  const estimate = [
    fiveHour === null ? null : `${formatPoints(fiveHour)} de tu ventana de 5 h`,
    sevenDay === null ? null : `${formatPoints(sevenDay)} de la semana`,
  ].filter((part): part is string => part !== null);

  const change = usage.measured.fiveHour;
  const { input, output, cacheWrite, cacheRead } = usage.tokens;
  return {
    tokens: `${formatTokens(usage.tokens.total)} tokens`,
    estimate: estimate.length > 0 ? estimate.join(' · ') : null,
    measured: change
      ? `La barra de 5 h subió del ${formatFraction(change.from)} al ${formatFraction(change.to)} mientras corría (incluye cualquier otro uso de tu cuenta).`
      : null,
    detail:
      `Entrada ${formatTokens(input)} · salida ${formatTokens(output)} · caché escrita ${formatTokens(cacheWrite)} · caché leída ${formatTokens(cacheRead)}. ` +
      (estimate.length > 0
        ? 'El porcentaje es una estimación.'
        : 'El porcentaje se estimará cuando haya al menos 2 ejecuciones medidas.'),
  };
}
