import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { CreatedRunner, Runner } from '../models/execution';
import { ExecutionsApi } from './executions.api';

export const RUNNERS_POLL_INTERVAL_MS = 5000;

/** Los runners registrados y si están conectados; se refresca solo para ver cuándo se conectan. */
@Injectable()
export class RunnersStore {
  private readonly api = inject(ExecutionsApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<Runner[]>([]);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly createdState = signal<CreatedRunner | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly runners = this.items.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** El runner recién creado, con su token: es la única vez que se puede ver. */
  readonly created = this.createdState.asReadonly();

  async load(destroyRef?: DestroyRef): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.listRunners()));
      this.loadedState.set(true);
      this.timer ??= setInterval(() => void this.refresh(), RUNNERS_POLL_INTERVAL_MS);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
    destroyRef?.onDestroy(() => this.stopPolling());
  }

  /** Crea el runner y deja su token a la vista. Devuelve si se pudo crear. */
  async create(name: string): Promise<boolean> {
    try {
      const created = await firstValueFrom(this.api.createRunner(name));
      this.createdState.set(created);
      // En la lista queda el runner sin su token: el token solo vive en `created`.
      const runner: Runner = { ...created };
      delete (runner as Partial<CreatedRunner>).token;
      this.items.update((list) => [...list, runner]);
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  /** Elige el runner predeterminado. */
  async setDefault(runner: Runner): Promise<void> {
    try {
      this.items.set(await firstValueFrom(this.api.setDefaultRunner(runner.id)));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  dismissCreated(): void {
    this.createdState.set(null);
  }

  async remove(runner: Runner): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteRunner(runner.id));
      this.items.update((list) => list.filter((item) => item.id !== runner.id));
      if (this.createdState()?.id === runner.id) this.createdState.set(null);
      // Si era el predeterminado, el servidor eligió otro: se vuelve a leer cuál.
      if (runner.isDefault) await this.refresh();
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async refresh(): Promise<void> {
    try {
      this.items.set(await firstValueFrom(this.api.listRunners()));
    } catch {
      // un fallo puntual del sondeo no debe molestar; el siguiente lo reintenta
    }
  }
}
