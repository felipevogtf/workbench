import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ExecutionsApi } from './executions.api';

/** Enlace que Windows asocia al runner (lo registra `npm run autostart:install`). */
export const RUNNER_START_URL = 'workbench-runner://start';
/** Cuánto se espera a que el runner se conecte tras pedirle que arranque. */
export const RUNNER_WAIT_MS = 20_000;
export const RUNNER_POLL_MS = 1500;

/**
 * - `connected`: hay un runner conectado (ya lo estaba o arrancó al pedírselo).
 * - `no-runners`: todavía no hay ningún runner creado; nadie podría hacer el trabajo.
 * - `timeout`: se le pidió arrancar y no se conectó a tiempo (¿no está instalado el enlace?).
 */
export type RunnerReadiness = 'connected' | 'no-runners' | 'timeout';

/**
 * Se asegura de que haya un runner conectado antes de ejecutar: si no lo hay, le pide a Windows que
 * abra el del PC (por el enlace `workbench-runner://`) y espera a que aparezca conectado.
 */
@Injectable({ providedIn: 'root' })
export class RunnerLauncher {
  private readonly api = inject(ExecutionsApi);

  async ensureOnline(): Promise<RunnerReadiness> {
    let runners = await this.list();
    if (runners === null) return 'connected'; // sin poder consultar, que decida el servidor al ejecutar
    if (runners.length === 0) return 'no-runners';
    if (runners.some((runner) => runner.online)) return 'connected';

    this.open(RUNNER_START_URL);

    const deadline = Date.now() + RUNNER_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, RUNNER_POLL_MS));
      runners = (await this.list()) ?? runners;
      if (runners.some((runner) => runner.online)) return 'connected';
    }
    return 'timeout';
  }

  /** Abre el enlace; el navegador pregunta la primera vez si dejar que Windows lo atienda. */
  protected open(url: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    link.click();
  }

  private async list() {
    try {
      return await firstValueFrom(this.api.listRunners());
    } catch {
      return null;
    }
  }
}
