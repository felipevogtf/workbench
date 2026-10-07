import { signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { errorMessage } from '@shared/util/error-message';

/**
 * Base de los stores de listas del módulo (proyectos, estados, etiquetas, tareas): carga una vez,
 * expone `loading`/`loaded`/`error` y ofrece los helpers para mantener la lista al día tras cada
 * acción. Cada subclase agrega sus propias acciones.
 */
export abstract class ResourceStore<T extends { id: string }> {
  protected readonly items = signal<T[]>([]);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();

  protected abstract fetchAll(): Observable<T[]>;

  /** Carga la lista; si ya está cargada no vuelve a pedirla salvo con `force`. */
  async load(force = false): Promise<void> {
    if (this.loadingState() || (this.loadedState() && !force)) return;

    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      this.items.set(await firstValueFrom(this.fetchAll()));
      this.loadedState.set(true);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  protected add(item: T): void {
    this.items.update((list) => [...list, item]);
  }

  protected replace(item: T): void {
    this.items.update((list) => list.map((current) => (current.id === item.id ? item : current)));
  }

  protected drop(id: string): void {
    this.items.update((list) => list.filter((item) => item.id !== id));
  }
}
