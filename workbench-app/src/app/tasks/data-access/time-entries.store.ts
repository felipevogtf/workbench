import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { TimeEntry } from '../models/catalogs';
import { TasksApi } from './tasks.api';

export interface DayHours {
  date: string;
  hours: number;
  entries: TimeEntry[];
}

/** Agrupa las entradas por día (más reciente primero); una tarea puede tener varias el mismo día. */
export function groupByDay(entries: readonly TimeEntry[]): DayHours[] {
  const days = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    days.set(entry.date, [...(days.get(entry.date) ?? []), entry]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      entries: list,
      hours: list.reduce((sum, entry) => sum + entry.hours, 0),
    }));
}

/** Horas registradas de una tarea. Se provee en la página de detalle (uno por tarea abierta). */
@Injectable()
export class TimeEntriesStore {
  private readonly api = inject(TasksApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<TimeEntry[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private issueId: string | null = null;

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly days = computed(() => groupByDay(this.items()));
  readonly totalHours = computed(() => this.items().reduce((sum, entry) => sum + entry.hours, 0));

  async load(issueId: string): Promise<void> {
    this.issueId = issueId;
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.listTimeEntries(issueId)));
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  /** Lanza el error al llamador: el formulario lo muestra. */
  async add(hours: number, date: string): Promise<void> {
    if (!this.issueId) return;
    const created = await firstValueFrom(
      this.api.createTimeEntry({ issueId: this.issueId, hours, date }),
    );
    this.items.update((list) => [...list, created]);
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteTimeEntry(id));
      this.items.update((list) => list.filter((entry) => entry.id !== id));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }
}
