import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { ExecutionListItem, isExecutionActive } from '../models/execution';
import { ExecutionsApi } from './executions.api';

export const HISTORY_POLL_INTERVAL_MS = 5000;

/**
 * El historial de todas las ejecuciones: las que están en marcha y las que ya terminaron. Se refresca
 * solo mientras la página está abierta, para ver avanzar lo que corre y lo que se lanza desde otra parte.
 */
@Injectable()
export class ExecutionHistoryStore {
  private readonly api = inject(ExecutionsApi);

  private readonly items = signal<ExecutionListItem[]>([]);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly executions = this.items.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();

  /** Las que están en marcha ahora. */
  readonly running = computed(() => this.items().filter(isExecutionActive));
  /** Las que ya terminaron (bien, mal o canceladas), de la más nueva a la más antigua. */
  readonly finished = computed(() => this.items().filter((item) => !isExecutionActive(item)));

  async load(destroyRef?: DestroyRef): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.listAll()));
      this.loadedState.set(true);
      this.timer ??= setInterval(() => void this.refresh(), HISTORY_POLL_INTERVAL_MS);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
    destroyRef?.onDestroy(() => this.stopPolling());
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async refresh(): Promise<void> {
    try {
      this.items.set(await firstValueFrom(this.api.listAll()));
    } catch {
      // un fallo puntual del sondeo no debe molestar; el siguiente lo reintenta
    }
  }
}
