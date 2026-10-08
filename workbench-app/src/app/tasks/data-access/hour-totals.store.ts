import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TasksApi } from './tasks.api';

/**
 * Horas registradas por tarea (id → horas), para mostrarlas en listas como el tablero. Las tareas
 * sin horas no aparecen. Un fallo no impide ver la lista: simplemente no hay totales.
 */
@Injectable({ providedIn: 'root' })
export class HourTotalsStore {
  private readonly api = inject(TasksApi);
  private readonly state = signal<Readonly<Record<string, number>>>({});

  readonly totals = this.state.asReadonly();

  /** Siempre vuelve a pedirlos: las horas cambian desde el detalle de cada tarea. */
  async load(): Promise<void> {
    try {
      this.state.set(await firstValueFrom(this.api.listHourTotals()));
    } catch {
      this.state.set({});
    }
  }
}
