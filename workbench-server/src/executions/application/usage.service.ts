import { Inject, Injectable } from '@nestjs/common';
import { Job } from '@executions/domain/entities/job.entity';
import {
  AI_CALLS_GATEWAY_PORT,
  type AiCallsGatewayPort,
} from '@executions/domain/ports/gateways.port';
import {
  JOB_REPOSITORY_PORT,
  type JobRepositoryPort,
} from '@executions/domain/ports/job-repository.port';
import {
  USAGE_SNAPSHOT_REPOSITORY_PORT,
  type UsageSnapshotRepositoryPort,
} from '@executions/domain/ports/usage-snapshot-repository.port';
import {
  NO_TOKENS,
  UsageLimits,
  UsageSnapshot,
  UsageTokens,
  UsageWindow,
  addTokens,
  totalTokens,
} from '@executions/domain/usage';

/** Cuánto después de terminar una ejecución puede estar la medida del plan para valer como «el después». */
const AFTER_WINDOW_MS = 10 * 60_000;
/** Una calibración se recalcula como mucho cada tanto: la pantalla de una ejecución se refresca sola. */
const CALIBRATION_TTL_MS = 5 * 60_000;
/** Cuánta historia mira la calibración y el gráfico por defecto. */
const HISTORY_DAYS = 60;
/** Cuántas ejecuciones medidas hacen falta para creerle a la calibración. */
const MIN_SAMPLES = 2;
/** Cuánto espera la pantalla una medida pedida con «Actualizar» antes de dejar de decir que está actualizando. */
const REFRESH_WAIT_MS = 90_000;

/** Una ventana del plan al empezar y al terminar la ejecución (fracciones de 0 a 1). */
export interface WindowChange {
  from: number;
  to: number;
  delta: number;
}

/** Cuánto vale 1 punto porcentual de cada ventana, en dólares a precio de lista, según lo medido hasta hoy. */
export interface Calibration {
  fiveHour: { costPerPoint: number | null; samples: number };
  sevenDay: { costPerPoint: number | null; samples: number };
}

export interface ExecutionUsage {
  /** Exactos: son la suma de lo que informó cada llamada a Claude de la ejecución. */
  tokens: UsageTokens & { total: number };
  costUsd: number;
  /** Lo que subió la ventana mientras corría: incluye cualquier otro uso de la cuenta en ese rato. */
  measured: { fiveHour: WindowChange | null; sevenDay: WindowChange | null };
  /** Puntos porcentuales estimados con la calibración; `null` mientras no haya con qué calibrar. */
  estimatedPoints: { fiveHour: number | null; sevenDay: number | null };
}

export interface DayUsage {
  date: string;
  tokens: number;
  costUsd: number;
  byKind: Record<string, number>;
  /** Puntos porcentuales de la semana que esos tokens habrían costado; `null` sin calibración. */
  estimatedPoints: number | null;
}

/** Una ventana de 5 horas del plan: cuánto se llegó a usar de toda la cuenta y cuánto gastó el Workbench dentro. */
export interface WindowUsage {
  /** El día en que empezó, en la zona horaria de quien mira. */
  date: string;
  /** ISO. */
  startsAt: string;
  /** ISO. */
  resetsAt: string;
  /** La mayor fracción (0 a 1) vista en la ventana; es el piso del uso real si no hubo medidas al final. */
  peak: number;
  /** Cuántas medidas del plan hay dentro: con pocas, el pico real puede ser mayor. */
  measures: number;
  tokens: number;
  costUsd: number;
}

/** Algo que gastó tokens: un trabajo del runner o una llamada del servidor. */
interface Spend {
  at: Date;
  tokens: number;
  costUsd: number;
  kind: string;
  agent: { id: string; name: string } | null;
}

const WINDOW_MS = 5 * 3_600_000;
/** Dos medidas cuyo reinicio difiere en menos que esto son de la misma ventana. */
const SAME_WINDOW_MS = 60_000;

/**
 * Cómo se llama en el gráfico lo que gastó cada módulo del servidor. Los chats van juntos (también con el
 * chat de la ejecución que contesta el runner, que es un trabajo de tipo `chat`).
 */
function kindOfModule(module: string): string {
  if (module === 'planner') return 'planner';
  if (module === 'task-chat' || module === 'task-tickets' || module === 'chat')
    return 'chat';
  return 'other';
}

/** Las ventanas de 5 horas que dejan ver las medidas del plan, con lo gastado dentro de cada una. */
function windowsOf(
  measures: readonly UsageSnapshot[],
  spends: readonly Spend[],
  timeZone: string,
): WindowUsage[] {
  const groups: { resetsAt: number; peak: number; count: number }[] = [];
  for (const measure of measures) {
    const window = measure.limits.fiveHour;
    if (!window) continue;
    const resetsAt = Date.parse(window.resetsAt);
    const last = groups.find(
      (group) => Math.abs(group.resetsAt - resetsAt) <= SAME_WINDOW_MS,
    );
    if (last) {
      last.peak = Math.max(last.peak, window.used);
      last.count += 1;
    } else {
      groups.push({ resetsAt, peak: window.used, count: 1 });
    }
  }

  return groups
    .sort((a, b) => a.resetsAt - b.resetsAt)
    .map((group) => {
      const start = group.resetsAt - WINDOW_MS;
      const inside = spends.filter(
        (spend) =>
          spend.at.getTime() >= start && spend.at.getTime() < group.resetsAt,
      );
      return {
        date: dayOf(new Date(start), timeZone),
        startsAt: new Date(start).toISOString(),
        resetsAt: new Date(group.resetsAt).toISOString(),
        peak: group.peak,
        measures: group.count,
        tokens: inside.reduce((sum, spend) => sum + spend.tokens, 0),
        costUsd: inside.reduce((sum, spend) => sum + spend.costUsd, 0),
      };
    });
}

/** Lo que gastó un agente en el período (los trabajos sin agente, como subir la rama, van juntos con `agentId` nulo). */
export interface AgentUsage {
  agentId: string | null;
  /** Su nombre técnico, para reconocerlo si el agente ya no existe. */
  agentName: string | null;
  jobs: number;
  tokens: number;
  costUsd: number;
  /** Puntos porcentuales de la semana que habría costado; `null` sin calibración. */
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
  calibration: Calibration;
  days: DayUsage[];
  /** Las ventanas de 5 horas del período, de la más antigua a la más nueva, con cuánto se llegó a usar en cada una. */
  windows: WindowUsage[];
  /** Lo mismo que el gráfico, repartido por agente, de mayor a menor gasto. */
  byAgent: AgentUsage[];
  today: { tokens: number; costUsd: number; estimatedPoints: number | null };
  week: { tokens: number; costUsd: number; estimatedPoints: number | null };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** El día de una fecha en una zona horaria, como `2026-10-25`. Una zona desconocida cuenta como UTC. */
function dayOf(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * El consumo de Claude: lo que gasta cada ejecución (tokens exactos) y cómo va el plan (porcentaje de la
 * ventana de 5 horas y de la semana). Anthropic solo informa el porcentaje de TODA la cuenta, así que lo
 * que cuesta una ejecución en porcentaje se mide como diferencia (que arrastra cualquier otro uso en ese
 * rato) y se estima con una calibración aprendida de las ejecuciones ya medidas.
 */
@Injectable()
export class UsageService {
  /** Cuándo se pidió actualizar, y si el latido del runner ya recibió el pedido. */
  private refreshAskedAt: number | null = null;
  private refreshTaken = false;
  private calibrationCache: { at: number; value: Calibration } | null = null;

  constructor(
    @Inject(USAGE_SNAPSHOT_REPOSITORY_PORT)
    private readonly snapshots: UsageSnapshotRepositoryPort,
    @Inject(JOB_REPOSITORY_PORT) private readonly jobs: JobRepositoryPort,
    @Inject(AI_CALLS_GATEWAY_PORT)
    private readonly aiCalls: AiCallsGatewayPort,
  ) {}

  /** Guarda una medida del plan (la trae cada trabajo, o una llamada mínima). Sin datos del plan no hace nada. */
  async record(
    limits: UsageLimits | null,
    source: 'job' | 'probe',
    jobId: string | null = null,
    at: Date = new Date(),
  ): Promise<void> {
    if (!limits) return;
    await this.snapshots.save({
      id: crypto.randomUUID(),
      takenAt: at,
      limits,
      source,
      jobId,
    });
  }

  /** El usuario pidió actualizar: el próximo latido del runner hará la medida. */
  requestRefresh(now = Date.now()): void {
    this.refreshAskedAt = now;
    this.refreshTaken = false;
  }

  /** Lo llama el latido del runner: `true` una sola vez por cada pedido. */
  takeRefreshRequest(): boolean {
    if (this.refreshAskedAt === null || this.refreshTaken) return false;
    this.refreshTaken = true;
    return true;
  }

  /** Lo que gastó una ejecución y, si se puede medir, cuánto subió el plan mientras corría. */
  async ofExecution(
    jobs: readonly Job[],
    calibration?: Calibration,
  ): Promise<ExecutionUsage> {
    const usable = calibration ?? (await this.calibration());
    const base = await this.measure(jobs);
    const points = (window: 'fiveHour' | 'sevenDay') => {
      const costPerPoint = usable[window].costPerPoint;
      return costPerPoint && base.costUsd > 0
        ? base.costUsd / costPerPoint
        : null;
    };
    return {
      ...base,
      estimatedPoints: {
        fiveHour: points('fiveHour'),
        sevenDay: points('sevenDay'),
      },
    };
  }

  /** Tokens, costo y lo medido, sin la estimación (que necesita la calibración, que a su vez usa esto). */
  private async measure(
    jobs: readonly Job[],
  ): Promise<Omit<ExecutionUsage, 'estimatedPoints'>> {
    let tokens = NO_TOKENS;
    let costUsd = 0;
    for (const job of jobs) {
      if (job.usage) tokens = addTokens(tokens, job.usage.tokens);
      costUsd += job.costUsd ?? 0;
    }

    const measured: ExecutionUsage['measured'] = {
      fiveHour: null,
      sevenDay: null,
    };
    const withLimits = jobs
      .filter((job) => job.usage?.limits)
      .sort(
        (a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0),
      );
    const before = withLimits[0]?.usage?.limits ?? null;
    const finished = jobs.length > 0 && jobs.every((job) => !job.isOpen);
    const end = Math.max(
      0,
      ...jobs.map((job) => job.finishedAt?.getTime() ?? 0),
    );

    if (before && finished && end > 0) {
      const after = await this.snapshots.findFirstAtOrAfter(new Date(end));
      if (after && after.takenAt.getTime() - end <= AFTER_WINDOW_MS) {
        for (const window of ['fiveHour', 'sevenDay'] as const) {
          measured[window] = this.change(before[window], after.limits[window]);
        }
      }
    }
    return {
      tokens: { ...tokens, total: totalTokens(tokens) },
      costUsd,
      measured,
    };
  }

  /** La diferencia de una ventana entre dos medidas; `null` si la ventana se reinició en el medio o no hay datos. */
  private change(
    from: UsageWindow | null,
    to: UsageWindow | null,
  ): WindowChange | null {
    if (!from || !to) return null;
    // Otra ventana (se reinició): la diferencia no dice nada.
    if (Math.abs(Date.parse(from.resetsAt) - Date.parse(to.resetsAt)) > 60_000)
      return null;
    const delta = to.used - from.used;
    return delta < 0 ? null : { from: from.used, to: to.used, delta };
  }

  /**
   * Cuánto cuesta (a precio de lista) 1 punto de cada ventana, aprendido de las ejecuciones ya medidas. Se usa
   * la mediana de lo que costó cada punto, para que una medida contaminada por otro uso de la cuenta no la
   * arruine. Hacen falta al menos dos ejecuciones con la ventana subiendo.
   */
  async calibration(now = Date.now()): Promise<Calibration> {
    if (
      this.calibrationCache &&
      now - this.calibrationCache.at < CALIBRATION_TTL_MS
    ) {
      return this.calibrationCache.value;
    }

    const jobs = await this.jobs.findFinishedSince(
      new Date(now - HISTORY_DAYS * 86_400_000),
    );
    const byExecution = new Map<string, Job[]>();
    for (const job of jobs) {
      byExecution.set(job.executionId, [
        ...(byExecution.get(job.executionId) ?? []),
        job,
      ]);
    }

    const ratios: Record<'fiveHour' | 'sevenDay', number[]> = {
      fiveHour: [],
      sevenDay: [],
    };
    for (const group of byExecution.values()) {
      const usage = await this.measure(group);
      for (const window of ['fiveHour', 'sevenDay'] as const) {
        const change = usage.measured[window];
        if (change && change.delta > 0 && usage.costUsd > 0) {
          ratios[window].push(usage.costUsd / (change.delta * 100));
        }
      }
    }

    const of = (window: 'fiveHour' | 'sevenDay') => ({
      costPerPoint:
        ratios[window].length >= MIN_SAMPLES ? median(ratios[window]) : null,
      samples: ratios[window].length,
    });
    const value = { fiveHour: of('fiveHour'), sevenDay: of('sevenDay') };
    this.calibrationCache = { at: now, value };
    return value;
  }

  /** La pantalla de consumo: cómo va el plan ahora, el gasto de cada día y el de hoy y la semana. */
  async overview(
    timeZone: string,
    days: number,
    now = new Date(),
  ): Promise<UsageOverview> {
    const since = new Date(now.getTime() - (days + 1) * 86_400_000);
    const [latest, calibration, jobs, calls, measures] = await Promise.all([
      this.snapshots.findLatest(),
      this.calibration(now.getTime()),
      this.jobs.findFinishedSince(since),
      this.aiCalls.since(since),
      this.snapshots.findSince(since),
    ]);

    // Lo gastado, venga de un trabajo del runner o de una llamada del servidor (planificador, chats…).
    const spends: Spend[] = [];
    for (const job of jobs) {
      if (!job.finishedAt || !job.usage) continue;
      spends.push({
        at: job.finishedAt,
        tokens: totalTokens(job.usage.tokens),
        costUsd: job.costUsd ?? 0,
        kind: job.kind,
        agent: job.payload.agent,
      });
    }
    for (const call of calls) {
      spends.push({
        at: call.at,
        tokens: totalTokens(call.tokens),
        costUsd: call.costUsd,
        kind: kindOfModule(call.module),
        agent: call.agentId
          ? { id: call.agentId, name: call.agentName ?? '' }
          : null,
      });
    }

    const perDay = new Map<string, DayUsage>();
    const today = dayOf(now, timeZone);
    for (let offset = days - 1; offset >= 0; offset--) {
      const date = dayOf(
        new Date(now.getTime() - offset * 86_400_000),
        timeZone,
      );
      perDay.set(date, {
        date,
        tokens: 0,
        costUsd: 0,
        byKind: {},
        estimatedPoints: null,
      });
    }
    const perAgent = new Map<string, AgentUsage>();
    for (const spend of spends) {
      const entry = perDay.get(dayOf(spend.at, timeZone));
      if (!entry) continue;
      const { tokens, agent } = spend;
      entry.tokens += tokens;
      entry.costUsd += spend.costUsd;
      entry.byKind[spend.kind] = (entry.byKind[spend.kind] ?? 0) + tokens;

      // Lo mismo, por agente: lo que gastó cada trabajador en el período.
      const key = agent?.id ?? 'none';
      const mine = perAgent.get(key) ?? {
        agentId: agent?.id ?? null,
        agentName: agent?.name ?? null,
        jobs: 0,
        tokens: 0,
        costUsd: 0,
        estimatedPoints: null,
      };
      mine.jobs += 1;
      mine.tokens += tokens;
      mine.costUsd += spend.costUsd;
      perAgent.set(key, mine);
    }

    const weekly = calibration.sevenDay.costPerPoint;
    const byAgent = [...perAgent.values()]
      .map((agent) => ({
        ...agent,
        estimatedPoints: weekly ? agent.costUsd / weekly : null,
      }))
      .sort((a, b) => b.tokens - a.tokens);
    const series = [...perDay.values()].map((day) => ({
      ...day,
      estimatedPoints: weekly ? day.costUsd / weekly : null,
    }));
    const sum = (items: DayUsage[]) => {
      const costUsd = items.reduce((total, day) => total + day.costUsd, 0);
      return {
        tokens: items.reduce((total, day) => total + day.tokens, 0),
        costUsd,
        estimatedPoints: weekly ? costUsd / weekly : null,
      };
    };

    const limits = latest?.limits;
    return {
      current: {
        fiveHour: limits?.fiveHour ?? null,
        sevenDay: limits?.sevenDay ?? null,
        takenAt: latest?.takenAt.toISOString() ?? null,
        ageSeconds: latest
          ? Math.max(
              0,
              Math.round((now.getTime() - latest.takenAt.getTime()) / 1000),
            )
          : null,
      },
      // Se pidió hace poco y todavía no llegó una medida posterior al pedido.
      refreshing:
        this.refreshAskedAt !== null &&
        now.getTime() - this.refreshAskedAt < REFRESH_WAIT_MS &&
        (!latest || latest.takenAt.getTime() < this.refreshAskedAt),
      calibration,
      days: series,
      windows: windowsOf(measures, spends, timeZone),
      byAgent,
      today: sum(series.filter((day) => day.date === today)),
      week: sum(series.slice(-7)),
    };
  }
}
