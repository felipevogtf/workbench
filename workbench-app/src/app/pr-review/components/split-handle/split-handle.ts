import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/**
 * Divisor vertical que se arrastra con el puntero o se mueve con las flechas. Solo informa lo que
 * pasa: `dragged` trae la posición X del puntero y `nudged` la dirección (-1 o 1) de una flecha.
 * Quien lo usa decide qué ancho cambia y lo posiciona.
 */
@Component({
  selector: 'app-split-handle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'separator',
    'aria-orientation': 'vertical',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
    '[class.is-dragging]': 'dragging()',
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'end($event)',
    '(pointercancel)': 'end($event)',
    '(keydown.arrowleft)': 'nudge($event, -1)',
    '(keydown.arrowright)': 'nudge($event, 1)',
  },
  template: '',
  styles: `
    :host {
      display: block;
      width: 10px;
      cursor: col-resize;
      touch-action: none;
      user-select: none;
      outline: none;
    }

    // La línea visible es fina; el área para agarrarla es más ancha.
    :host::after {
      content: '';
      display: block;
      width: 2px;
      height: 100%;
      margin: 0 auto;
      border-radius: var(--radius-pill);
      background: var(--border);
      transition: background-color 0.15s ease;
    }

    :host(:hover)::after,
    :host(:focus-visible)::after,
    :host(.is-dragging)::after {
      background: var(--primary);
    }
  `,
})
export class SplitHandle {
  readonly label = input.required<string>();

  readonly dragged = output<number>();
  readonly nudged = output<-1 | 1>();

  protected readonly dragging = signal(false);

  protected start(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragging.set(true);
    event.preventDefault();
  }

  protected move(event: PointerEvent): void {
    if (this.dragging()) this.dragged.emit(event.clientX);
  }

  protected end(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    this.dragging.set(false);
  }

  protected nudge(event: Event, direction: -1 | 1): void {
    event.preventDefault();
    this.nudged.emit(direction);
  }
}
