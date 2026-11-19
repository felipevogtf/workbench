import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { OrganizerStore } from '../../data-access/organizer.store';

/**
 * Una conversación nueva (`/organizer/new`): no pide nada. Crea la sesión vacía y abre su pantalla (reemplazando esta ruta en el
 * historial, para que «atrás» no vuelva a crear otra). Los proyectos y los tickets se suman después, desde la propia sesión.
 */
@Component({
  selector: 'app-organizer-new-page',
  imports: [RouterLink, Alert, Button, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (failed()) {
        <app-alert tone="danger" heading="No se pudo crear la conversación">
          Revisa la conexión e inténtalo de nuevo.
          <a alert-action app-button variant="secondary" size="sm" routerLink="/organizer">
            Volver al organizador
          </a>
        </app-alert>
      } @else {
        <div class="stack" aria-busy="true">
          <app-skeleton height="48px" />
          <app-skeleton height="320px" />
        </div>
      }
    </div>
  `,
})
export class OrganizerNewPage {
  private readonly store = inject(OrganizerStore);
  private readonly router = inject(Router);

  protected readonly failed = signal(false);

  constructor() {
    void this.start();
  }

  private async start(): Promise<void> {
    const session = await this.store.create();
    if (!session) {
      this.failed.set(true);
      return;
    }
    await this.router.navigate(['/organizer', session.id], { replaceUrl: true });
  }
}
