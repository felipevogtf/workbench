import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  model,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';
import { IconButton } from '../icon-button/icon-button';

/**
 * Diálogo modal sobre el elemento nativo `<dialog>` (foco atrapado y `Esc` incluidos).
 * `[(open)]` controla la visibilidad. Slot `[dialog-footer]` para las acciones.
 * En móvil es una hoja que sube desde abajo; en desktop, una ventana centrada.
 */
@Component({
  selector: 'app-dialog',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      [attr.aria-labelledby]="titleId"
      (close)="open.set(false)"
      tabindex="-1"
      (keydown.escape)="open.set(false)"
      (click)="onBackdropClick($event)"
    >
      <div class="dialog__panel">
        <header>
          <h3 [id]="titleId">{{ heading() }}</h3>
          <button app-icon-button type="button" label="Cerrar" (click)="open.set(false)">
            <app-icon name="x" />
          </button>
        </header>
        <div class="dialog__body"><ng-content /></div>
        <footer><ng-content select="[dialog-footer]" /></footer>
      </div>
    </dialog>
  `,
  styleUrl: './dialog.scss',
})
export class Dialog {
  private static nextId = 0;

  readonly open = model(false);
  readonly heading = input.required<string>();

  protected readonly titleId = `dialog-title-${Dialog.nextId++}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        if (!element.open) element.showModal();
      } else if (element.open) {
        element.close();
      }
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    // Un clic directo sobre <dialog> (y no sobre su panel) es un clic en el fondo.
    if (event.target === this.dialog().nativeElement) {
      this.open.set(false);
    }
  }
}
