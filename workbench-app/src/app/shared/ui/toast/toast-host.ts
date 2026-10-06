import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../icon/icon';
import { IconButton } from '../icon-button/icon-button';
import { Toast } from './toast';

/** Se declara una sola vez en el componente raíz. */
@Component({
  selector: 'app-toast-host',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toasts.messages(); track toast.id) {
        <div
          class="toast"
          [attr.data-tone]="toast.tone"
          [attr.role]="toast.tone === 'danger' ? 'alert' : 'status'"
        >
          <span class="toast__text">{{ toast.message }}</span>
          <button
            app-icon-button
            type="button"
            label="Cerrar aviso"
            (click)="toasts.dismiss(toast.id)"
          >
            <app-icon name="x" size="1rem" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      z-index: 100;
      left: var(--space-4);
      right: var(--space-4);
      bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      background: var(--primary);
      color: var(--background);
      box-shadow: var(--shadow-hover);
      pointer-events: auto;
      animation: toast-in 0.2s ease-out;
    }

    .toast[data-tone='danger'] {
      background: color-mix(in srgb, var(--danger) 80%, var(--primary));
    }

    .toast[data-tone='success'] {
      background: color-mix(in srgb, var(--success) 45%, var(--primary));
    }

    .toast__text {
      overflow-wrap: anywhere;
    }

    @media (min-width: 768px) {
      .toasts {
        left: auto;
        width: 380px;
      }
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(Toast);
}
