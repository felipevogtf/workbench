import { hostname } from 'node:os';
import { ApiError, type ServerApi } from './api';
import type { RunnerConfig } from './config';
import { probeUsage } from './claude';
import type { Environments } from './environment';
import { runJob } from './jobs';
import type { JobUsage, RunnerJob } from './types';
import type { Workspaces } from './workspace';

export const VERSION = '0.1.0';

const HEARTBEAT_MS = 15_000;
const LOG_FLUSH_MS = 2_000;
const MAX_LOG_CHUNK = 20_000;
const BACKOFF_START_MS = 2_000;
const BACKOFF_MAX_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Quita lo que sería una credencial en el registro que viaja al servidor. */
export function scrub(text: string): string {
  return text
    .replace(/(sk-ant-[\w-]{10,})/g, '***')
    .replace(/(wbr_[\w-]{10,})/g, '***')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1***@');
}

interface Running {
  controller: AbortController;
}

/**
 * El ciclo del runner: se presenta, pide trabajo, lo hace y entrega el resultado. Hace un trabajo a la
 * vez. Una señal de vida independiente avisa al servidor que sigue vivo (y de qué trabajo) y recibe
 * qué trabajos debe detener.
 */
export class Worker {
  private readonly running = new Map<string, Running>();
  private stopped = false;

  constructor(
    private readonly api: ServerApi,
    private readonly config: RunnerConfig,
    private readonly workspaces: Workspaces,
    private readonly log: (message: string) => void = console.log,
    /** Cada cuánto da señal de vida; las pruebas lo acortan. */
    private readonly heartbeatMs: number = HEARTBEAT_MS,
    /** Los entornos de prueba (contenedores) de las ejecuciones; sin él, el runner no levanta nada. */
    private readonly environments?: Environments,
  ) {}

  stop(): void {
    this.stopped = true;
    for (const { controller } of this.running.values()) controller.abort();
  }

  async run(): Promise<void> {
    await this.introduce();
    const heartbeat = setInterval(() => void this.beat(), this.heartbeatMs);
    let backoff = BACKOFF_START_MS;

    try {
      while (!this.stopped) {
        try {
          const job = await this.api.claim();
          backoff = BACKOFF_START_MS;
          if (job) await this.handle(job);
        } catch (error) {
          if (this.stopped) break;
          this.log(
            `No se pudo hablar con el servidor: ${(error as Error).message}. Reintento en ${backoff / 1000} s`,
          );
          await sleep(backoff);
          backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
        }
      }
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async introduce(): Promise<void> {
    for (
      let wait = BACKOFF_START_MS;
      !this.stopped;
      wait = Math.min(wait * 2, BACKOFF_MAX_MS)
    ) {
      try {
        await this.api.hello({ version: VERSION, host: hostname() });
        this.log(`Conectado a ${this.config.serverUrl}`);
        return;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          throw new Error(
            'El servidor rechazó el token: revisa `token` en la configuración (¿revocaste el runner?)',
          );
        }
        this.log(
          `No se pudo conectar: ${(error as Error).message}. Reintento en ${wait / 1000} s`,
        );
        await sleep(wait);
      }
    }
  }

  private async beat(): Promise<void> {
    // Un entorno que nadie usa hace rato (ejecución cancelada o caída) no se queda gastando recursos.
    void this.environments?.sweepIdle().catch(() => undefined);
    try {
      const { stop, probe } = await this.api.heartbeat([
        ...this.running.keys(),
      ]);
      if (probe) void this.probe();
      for (const id of stop) {
        const running = this.running.get(id);
        if (running && !running.controller.signal.aborted) {
          this.log(
            `El servidor canceló el trabajo ${id.slice(0, 8)}; se detiene`,
          );
          running.controller.abort();
        }
      }
    } catch {
      // sin señal por un momento: el próximo latido lo reintenta
    }
  }

  private probing = false;

  /** El usuario pidió ver cómo va el plan: una llamada mínima, una a la vez. */
  private async probe(): Promise<void> {
    if (this.probing) return;
    this.probing = true;
    try {
      const usage = await probeUsage({
        bin: this.config.claudeBin,
        binArgs: this.config.claudeBinArgs,
      });
      if (usage) await this.api.reportUsage(usage);
    } catch {
      // un dato de cortesía: si falla, el próximo trabajo trae otra medida
    } finally {
      this.probing = false;
    }
  }

  private async handle(job: RunnerJob): Promise<void> {
    const controller = new AbortController();
    this.running.set(job.id, { controller });
    this.log(`Trabajo ${job.id.slice(0, 8)}: ${job.kind}`);

    let pending = '';
    let lastFlush = Date.now();
    const flush = async () => {
      if (!pending) return;
      const text = pending.slice(0, MAX_LOG_CHUNK);
      pending = pending.slice(MAX_LOG_CHUNK);
      lastFlush = Date.now();
      try {
        // El servidor responde `false` si el trabajo ya no es de este runner: no tiene sentido seguir.
        if (!(await this.api.logs(job.id, text))) controller.abort();
      } catch {
        // los registros se pierden antes que frenar el trabajo
      }
    };
    const timer = setInterval(() => void flush(), LOG_FLUSH_MS);
    const onLog = (line: string) => {
      const clean = scrub(line);
      this.log(`  ${clean}`);
      pending += `${clean}\n`;
      if (Date.now() - lastFlush > LOG_FLUSH_MS * 2) void flush();
    };

    let outcome:
      | {
          ok: true;
          result: Awaited<ReturnType<typeof runJob>>['result'];
          costUsd: number | null;
          usage?: JobUsage;
        }
      | { ok: false; error: string; costUsd: number | null; usage?: JobUsage };
    try {
      const done = await runJob(job, {
        config: this.config,
        workspaces: this.workspaces,
        environments: this.environments,
        onLog,
        signal: controller.signal,
      });
      outcome = {
        ok: true,
        result: done.result,
        costUsd: done.costUsd,
        ...(done.usage ? { usage: done.usage } : {}),
      };
    } catch (error) {
      const message = scrub((error as Error).message);
      onLog(`✖ ${message}`);
      outcome = {
        ok: false,
        error: message,
        costUsd: (error as { costUsd?: number | null }).costUsd ?? null,
        ...((error as { usage?: JobUsage | null }).usage
          ? { usage: (error as { usage: JobUsage }).usage }
          : {}),
      };
    } finally {
      clearInterval(timer);
    }

    await flush();
    this.running.delete(job.id);
    await this.report(job, outcome);
  }

  private async report(
    job: RunnerJob,
    outcome: Parameters<ServerApi['finish']>[1],
  ): Promise<void> {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await this.api.finish(job.id, outcome);
        this.log(
          `Trabajo ${job.id.slice(0, 8)} entregado (${outcome.ok ? 'ok' : 'con error'})`,
        );
        return;
      } catch (error) {
        this.log(
          `No se pudo entregar el resultado (intento ${attempt}): ${(error as Error).message}`,
        );
        await sleep(attempt * 3_000);
      }
    }
    this.log(
      `El resultado del trabajo ${job.id.slice(0, 8)} no llegó al servidor; lo dará por perdido`,
    );
  }
}
