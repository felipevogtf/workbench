import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Button } from '../button/button';
import { Dialog } from '../dialog/dialog';
import { ConfirmDialog } from './confirm-dialog';

/** Se declara una sola vez en el componente raíz. */
@Component({
  selector: 'app-confirm-host',
  imports: [Dialog, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog
      [heading]="request()?.title ?? ''"
      [open]="isOpen()"
      (openChange)="!$event && service.answer(false)"
    >
      <p>{{ request()?.message }}</p>
      <ng-container dialog-footer>
        <button app-button variant="secondary" type="button" (click)="service.answer(false)">
          {{ request()?.cancelLabel ?? 'Cancelar' }}
        </button>
        <button
          app-button
          type="button"
          [variant]="request()?.tone === 'danger' ? 'danger' : 'primary'"
          (click)="service.answer(true)"
        >
          {{ request()?.confirmLabel ?? 'Confirmar' }}
        </button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    p {
      margin: 0;
    }
  `,
})
export class ConfirmHost {
  protected readonly service = inject(ConfirmDialog);
  protected readonly request = this.service.request;
  protected readonly isOpen = computed(() => this.request() !== null);
}
