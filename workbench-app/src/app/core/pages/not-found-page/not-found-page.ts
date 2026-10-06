import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/ui/button/button';
import { EmptyState } from '@shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, Button, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-empty-state icon="alert" heading="Página no encontrada">
        La dirección que buscas no existe o cambió de lugar.
        <a empty-action app-button routerLink="/">Ir al inicio</a>
      </app-empty-state>
    </div>
  `,
})
export class NotFoundPage {}
