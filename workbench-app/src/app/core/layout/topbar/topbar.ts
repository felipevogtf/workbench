import { Injectable, TemplateRef, signal } from '@angular/core';

/**
 * Lo que una pantalla pone en la barra superior de la app: un subtítulo junto al nombre y sus acciones a la derecha. Solo se ve en
 * las pantallas que muestran esa barra (las inmersivas y el móvil). La pantalla lo pone al abrirse y lo quita al cerrarse.
 */
@Injectable({ providedIn: 'root' })
export class Topbar {
  private readonly subtitleState = signal<string | null>(null);
  private readonly actionsState = signal<TemplateRef<unknown> | null>(null);

  readonly subtitle = this.subtitleState.asReadonly();
  readonly actions = this.actionsState.asReadonly();

  set(content: { subtitle?: string | null; actions?: TemplateRef<unknown> | null }): void {
    this.subtitleState.set(content.subtitle ?? null);
    this.actionsState.set(content.actions ?? null);
  }

  clear(): void {
    this.set({});
  }
}
