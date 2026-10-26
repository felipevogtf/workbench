import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { UsageOverview } from '../models/usage';
import { ExecutionsApi } from './executions.api';

/** Cada cuánto se vuelve a mirar el consumo; más seguido mientras se espera una medida nueva. */
export const USAGE_POLL_MS = 30_000;
export const USAGE_REFRESHING_POLL_MS = 3_000;
/** Una medida más vieja que esto se renueva sola al abrir la pantalla. */
export const USAGE_STALE_SECONDS = 30 * 60;
const DAYS = 14;

/**
 * El consumo de Claude: cómo va el plan y lo que gastó el Workbench cada día. Se actualiza solo mientras
 * la pantalla está abierta, y si la última medida es vieja pide una nueva al runner.
 */
@Injectable()
export class UsageStore {
  private readonly api = inject(ExecutionsApi);
  private readonly toast = inject(Toast);

  private readonly overviewState = signal<UsageOverview | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly nowState = signal(Date.now());
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  /** La zona horaria de quien mira: el gasto se reparte por día según ella. */
  private readonly zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  readonly overview = this.overviewState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** El momento con que se cuenta cuánto falta para cada reinicio. */
  readonly now = this.nowState.asReadonly();
  readonly refreshing = computed(() => this.overviewState()?.refreshing ?? false);

  async load(destroyRef?: DestroyRef): Promise<void> {
    destroyRef?.onDestroy(() => this.stop());
    await this.fetch();

    const current = this.overviewState()?.current;
    if (current && (current.ageSeconds === null || current.ageSeconds > USAGE_STALE_SECONDS)) {
      await this.refresh();
    }
    this.schedule();
  }

  /** Pide una medida nueva del plan: la hace el runner con su próximo latido. */
  async refresh(): Promise<void> {
    try {
      await firstValueFrom(this.api.refreshUsage());
      await this.fetch();
      this.schedule();
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async fetch(): Promise<void> {
    this.loadingState.set(true);
    try {
      this.overviewState.set(await firstValueFrom(this.api.usage(this.zone, DAYS)));
      this.errorState.set(null);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.nowState.set(Date.now());
      this.loadingState.set(false);
    }
  }

  private schedule(): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(
      () => {
        void this.fetch().then(() => this.schedule());
      },
      this.refreshing() ? USAGE_REFRESHING_POLL_MS : USAGE_POLL_MS,
    );
  }
}
