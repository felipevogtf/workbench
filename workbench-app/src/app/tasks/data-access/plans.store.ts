import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { Plan, PlanRequest, isPlanActive } from '../models/plan';
import { TasksApi } from './tasks.api';

export const PLAN_POLL_INTERVAL_MS = 3000;

/**
 * Planes de ejecución de la tarea abierta: el historial, el que se está viendo y el sondeo mientras
 * uno se genera. Se provee en la página de detalle (uno por tarea abierta).
 */
@Injectable()
export class PlansStore {
  private readonly api = inject(TasksApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<Plan[]>([]);
  private readonly viewedId = signal<string | null>(null);
  private readonly contents = signal<ReadonlyMap<string, string>>(new Map());
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly requestingState = signal(false);
  private issueId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly plans = this.items.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly requesting = this.requestingState.asReadonly();

  /** El plan en cola o generándose, si lo hay. */
  readonly active = computed(() => this.items().find(isPlanActive) ?? null);
  /** El plan que se muestra: el elegido o, si no, el último que está listo. */
  readonly viewed = computed(() => {
    const id = this.viewedId();
    const list = this.items();
    return (
      list.find((plan) => plan.id === id) ?? list.find((plan) => plan.status === 'ready') ?? null
    );
  });
  readonly viewedContent = computed(() => {
    const plan = this.viewed();
    return plan ? (this.contents().get(plan.id) ?? null) : null;
  });
  /** El último plan que falló, si es más nuevo que el último listo (para mostrar el motivo). */
  readonly latestFailed = computed(() => {
    const [latest] = this.items();
    return latest?.status === 'failed' ? latest : null;
  });

  async load(issueId: string, destroyRef?: DestroyRef): Promise<void> {
    this.issueId = issueId;
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.listPlans(issueId)));
      await this.ensureContent();
      this.syncPolling();
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
    destroyRef?.onDestroy(() => this.stopPolling());
  }

  /** Pide un plan nuevo (queda en cola) y empieza a seguirlo. */
  async generate(request: PlanRequest = {}): Promise<void> {
    if (!this.issueId) return;
    this.requestingState.set(true);
    try {
      const created = await firstValueFrom(this.api.createPlan(this.issueId, request));
      this.items.update((list) => [created, ...list]);
      this.syncPolling();
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.requestingState.set(false);
    }
  }

  /** Muestra un plan del historial (pide su contenido si todavía no lo tiene). */
  async view(id: string): Promise<void> {
    this.viewedId.set(id);
    await this.ensureContent();
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deletePlan(id));
      this.items.update((list) => list.filter((plan) => plan.id !== id));
      if (this.viewedId() === id) this.viewedId.set(null);
      await this.ensureContent();
      this.toast.success('Plan eliminado');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  /** Vuelve a pedir el historial; si un plan terminó, pasa a mostrarlo. */
  async refresh(): Promise<void> {
    if (!this.issueId) return;
    const wasActive = this.active();
    try {
      this.items.set(await firstValueFrom(this.api.listPlans(this.issueId)));
    } catch {
      // Un fallo de red momentáneo no debe borrar lo que se ve; se reintenta en el siguiente tick.
      return;
    }

    const finished = wasActive && this.items().find((plan) => plan.id === wasActive.id);
    if (finished?.status === 'ready') this.viewedId.set(finished.id);
    await this.ensureContent();
    this.syncPolling();
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private syncPolling(): void {
    if (this.active() && !this.timer) {
      this.timer = setInterval(() => void this.refresh(), PLAN_POLL_INTERVAL_MS);
    } else if (!this.active()) {
      this.stopPolling();
    }
  }

  /** Trae el markdown del plan que se muestra, si es de uno listo y aún no se tiene. */
  private async ensureContent(): Promise<void> {
    const plan = this.viewed();
    if (!plan || plan.status !== 'ready' || this.contents().has(plan.id)) return;

    try {
      const full = await firstValueFrom(this.api.getPlan(plan.id));
      this.contents.update((map) => new Map(map).set(plan.id, full.content ?? ''));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }
}
