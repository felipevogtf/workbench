import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { ExecutionDetail, isExecutionActive } from '../models/execution';
import { ExecutionsApi } from './executions.api';

export const EXECUTION_POLL_INTERVAL_MS = 3000;

/**
 * Una ejecución abierta: su detalle, el registro del trabajo que se está mirando y el sondeo mientras
 * está en marcha. Se provee en la página de la ejecución.
 */
@Injectable()
export class ExecutionStore {
  private readonly api = inject(ExecutionsApi);
  private readonly toast = inject(Toast);

  private readonly detailState = signal<ExecutionDetail | null>(null);
  private readonly errorState = signal<string | null>(null);
  private readonly loadingState = signal(false);
  private readonly actingState = signal(false);
  private readonly pickedJobId = signal<string | null>(null);
  private readonly logsState = signal<string>('');
  private id: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly detail = this.detailState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly acting = this.actingState.asReadonly();
  readonly logs = this.logsState.asReadonly();

  readonly active = computed(() => {
    const detail = this.detailState();
    return !!detail && isExecutionActive(detail);
  });

  /** El trabajo cuyo registro se muestra: el elegido o, si no, el último. */
  readonly selectedJob = computed(() => {
    const jobs = this.detailState()?.jobs ?? [];
    return jobs.find((job) => job.id === this.pickedJobId()) ?? jobs.at(-1) ?? null;
  });

  async load(id: string, destroyRef?: DestroyRef): Promise<void> {
    this.id = id;
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      await this.fetch();
      this.syncPolling();
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
    destroyRef?.onDestroy(() => this.stopPolling());
  }

  /** Muestra el registro de otro trabajo. */
  async selectJob(jobId: string): Promise<void> {
    this.pickedJobId.set(jobId);
    this.logsState.set('');
    await this.fetchLogs();
  }

  async cancel(): Promise<boolean> {
    return this.act((id) => this.api.cancel(id));
  }

  async begin(): Promise<boolean> {
    return this.act((id) => this.api.begin(id));
  }

  async assign(
    ticketId: string,
    body: { developerId?: string; reviewerId?: string },
  ): Promise<boolean> {
    return this.act((id) => this.api.assign(id, ticketId, body));
  }

  async retry(): Promise<boolean> {
    return this.act((id) => this.api.retry(id));
  }

  private async act(call: (id: string) => ReturnType<ExecutionsApi['cancel']>): Promise<boolean> {
    if (!this.id) return false;
    this.actingState.set(true);
    try {
      await firstValueFrom(call(this.id));
      await this.fetch();
      this.syncPolling();
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    } finally {
      this.actingState.set(false);
    }
  }

  private async fetch(): Promise<void> {
    if (!this.id) return;
    const previous = this.selectedJob()?.id;
    this.detailState.set(await firstValueFrom(this.api.get(this.id)));
    // Si apareció un trabajo nuevo y no se eligió otro, el registro cambia al nuevo.
    if (this.selectedJob()?.id !== previous) this.logsState.set('');
    await this.fetchLogs();
  }

  private async fetchLogs(): Promise<void> {
    const job = this.selectedJob();
    if (!job) return;
    try {
      const { logs } = await firstValueFrom(this.api.logs(job.id));
      // Solo si siguen mirando el mismo trabajo: una respuesta lenta no pisa a otra más nueva.
      if (this.selectedJob()?.id === job.id) this.logsState.set(logs);
    } catch {
      // los registros son un extra: sin ellos el resto de la pantalla sigue sirviendo
    }
  }

  private syncPolling(): void {
    if (this.active() && !this.timer) {
      this.timer = setInterval(() => void this.refresh(), EXECUTION_POLL_INTERVAL_MS);
    } else if (!this.active()) {
      this.stopPolling();
    }
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async refresh(): Promise<void> {
    try {
      await this.fetch();
    } catch {
      // un fallo puntual del sondeo no debe molestar; el siguiente lo reintenta
    }
    this.syncPolling();
  }
}
