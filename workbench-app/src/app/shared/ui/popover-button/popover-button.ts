import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icons';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
];

/**
 * Botón de solo ícono que despliega un panel con el contenido proyectado (filtros, opciones). A
 * diferencia de `app-menu`, el panel no se cierra al usar lo que tiene dentro: se cierra con `Esc`
 * o al hacer clic fuera.
 */
@Component({
  selector: 'app-popover-button',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="popover__trigger"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      (click)="open.set(!open())"
    >
      <app-icon [name]="icon()" />
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      (overlayOutsideClick)="onOutsideClick($event)"
      (overlayKeydown)="onKeydown($event)"
      (detach)="open.set(false)"
    >
      <div class="popover__panel" role="dialog" [attr.aria-label]="label()">
        <ng-content />
      </div>
    </ng-template>
  `,
  styleUrl: './popover-button.scss',
})
export class PopoverButton {
  /** Nombre accesible del botón (obligatorio: es solo un ícono). */
  readonly label = input.required<string>();
  readonly icon = input<IconName>('filter');

  protected readonly open = signal(false);
  protected readonly positions = POSITIONS;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected onOutsideClick(event: MouseEvent): void {
    // Un clic en el propio botón lo maneja el botón (abre o cierra); aquí solo cuenta lo de fuera.
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.open.set(false);
  }
}
