import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { Execution, isExecutionActive } from '../models/execution';
import { ExecutionsApi } from './executions.api';

export const EXECUTIONS_POLL_INTERVAL_MS = 3000;

/**
 * Ejecuciones de la tarea abierta: el historial y el sondeo mientras una está en marcha. Se provee en
 * la página de detalle de la tarea (uno por tarea abierta).
 */
@Injectable()
export class IssueExecutionsStore {
  private readonly api = inject(ExecutionsApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<Execution[]>([]);
  private readonly loadingState = signal(false);
  private readonly startingState = signal(false);
  private issueId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Del más nuevo al más antiguo. */
  readonly executions = this.items.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly starting = this.startingState.asReadonly();

  /** La que está en marcha, si la hay (solo puede haber una por tarea). */
  readonly active = computed(() => this.items().find(isExecutionActive) ?? null);
  readonly latest = computed(() => this.items()[0] ?? null);

  async load(issueId: string, destroyRef?: DestroyRef): Promise<void> {
    this.issueId = issueId;
    this.loadingState.set(true);
    try {
      this.items.set(await firstValueFrom(this.api.listByIssue(issueId)));
      this.syncPolling();
    } catch (error) {
      // Es un panel auxiliar: si no carga, la tarea sigue funcionando.
      this.toast.error(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
    destroyRef?.onDestroy(() => this.stopPolling());
  }

  /** Empieza a ejecutar la tarea. Devuelve la ejecución nueva, o `null` si el servidor la rechazó. */
  async start(): Promise<Execution | null> {
    if (!this.issueId) return null;
    this.startingState.set(true);
    try {
      const created = await firstValueFrom(this.api.start(this.issueId));
      this.items.update((list) => [created, ...list]);
      this.syncPolling();
      return created;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return null;
    } finally {
      this.startingState.set(false);
    }
  }

  private syncPolling(): void {
    if (this.active() && !this.timer) {
      this.timer = setInterval(() => void this.refresh(), EXECUTIONS_POLL_INTERVAL_MS);
    } else if (!this.active()) {
      this.stopPolling();
    }
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async refresh(): Promise<void> {
    if (!this.issueId) return;
    try {
      this.items.set(await firstValueFrom(this.api.listByIssue(this.issueId)));
    } catch {
      // un fallo puntual del sondeo no debe molestar; el siguiente lo reintenta
    }
    this.syncPolling();
  }
}
